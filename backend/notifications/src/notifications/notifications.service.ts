import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationEventsService } from './notification-events.service';
import {
  NotificationDeliveryAttemptEntity,
  NotificationDeliveryAttemptStatus
} from './notification-delivery-attempt.entity';
import {
  NotificationEntity,
  NotificationStatus
} from './notification.entity';
import { NotificationEventEntity } from './notification-event.entity';
import { NotificationsConfiguration } from '../config/configuration';
import { IncomingNotificationDto } from './dto/incoming-notification.dto';
import { QueryFailedError } from 'typeorm/error/QueryFailedError';
import { NotificationStatusResponse } from './dto/notification-status.response';

interface DispatchMessage {
  notificationId: string;
  eventKey: string;
  payload: Record<string, unknown>;
  recipients: CreateNotificationDto['recipients'];
  channelOverrides: string[];
  deduplicationKey: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly retryOptions: NotificationsConfiguration['dispatch']['retry'];

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    @InjectRepository(NotificationDeliveryAttemptEntity)
    private readonly attemptsRepository: Repository<NotificationDeliveryAttemptEntity>,
    @InjectRepository(NotificationEventEntity)
    private readonly notificationEventsRepository: Repository<NotificationEventEntity>,
    private readonly notificationEventsService: NotificationEventsService,
    private readonly amqpConnection: AmqpConnection,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService<NotificationsConfiguration>
  ) {
    this.retryOptions = this.configService.getOrThrow('dispatch.retry', { infer: true });
  }

  async enqueue(dto: CreateNotificationDto): Promise<NotificationEntity> {
    if (dto.deduplicationKey) {
      const existing = await this.notificationsRepository.findOne({
        where: { deduplicationKey: dto.deduplicationKey }
      });
      if (existing) {
        throw new ConflictException('duplicate_notification');
      }
    }

    const notification = this.notificationsRepository.create({
      eventKey: dto.eventKey,
      recipients: dto.recipients,
      payload: dto.payload,
      channelOverrides: dto.channelOverrides ?? null,
      deduplicationKey: dto.deduplicationKey ?? null,
      status: NotificationStatus.PENDING,
      attemptsCount: 0,
      lastAttemptAt: null,
      lastError: null
    });

    try {
      await this.notificationsRepository.save(notification);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('duplicate_notification');
      }
      throw error;
    }

    const message: DispatchMessage = {
      notificationId: notification.id,
      eventKey: notification.eventKey,
      payload: notification.payload,
      recipients: notification.recipients,
      channelOverrides: notification.channelOverrides ?? [],
      deduplicationKey: notification.deduplicationKey
    };

    let attemptNumber = 0;

    try {
      await this.executeWithRetry('rabbitmq', async () => {
        await this.publishToRabbit(notification, message, ++attemptNumber);
      });

      await this.executeWithRetry('redis', async () => {
        await this.publishToRedis(notification, message, ++attemptNumber);
      });

      await this.executeWithRetry('events-service', async () => {
        await this.dispatchInternally(dto, notification, ++attemptNumber);
      });

      await this.notificationsRepository.update(notification.id, {
        status: NotificationStatus.PROCESSED
      });
      this.logger.log(`Notification ${notification.id} dispatched successfully.`);
    } catch (error) {
      await this.notificationsRepository.update(notification.id, {
        status: NotificationStatus.FAILED,
        lastError: error instanceof Error ? error.message : 'dispatch_failed'
      });
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to dispatch notification ${notification.id}`, stack);
      throw error;
    }

    return this.notificationsRepository.findOneByOrFail({ id: notification.id });
  }

  async getStatus(id: string): Promise<NotificationStatusResponse | null> {
    const notification = await this.notificationsRepository.findOne({
      where: { id },
      relations: { attempts: true }
    });

    if (!notification) {
      return null;
    }

    const events = await this.notificationEventsRepository.find({
      where: {
        payload: Raw(
          (alias) => `${alias} ->> 'notificationId' = :notificationId`,
          { notificationId: id }
        )
      },
      order: { createdAt: 'DESC' }
    });

    const attempts = notification.attempts ?? [];
    const channels = Array.from(new Set(attempts.map((attempt) => attempt.channel))).sort();

    const deliveredEvent = events.find((event) => {
      if (event.deliveredToTelegram) {
        return true;
      }

      const status = event.telegramDeliveryStatus?.toLowerCase();
      return status === 'delivered';
    });

    const deliveredAt = deliveredEvent?.telegramDeliveryOccurredAt ?? null;
    const status = deliveredEvent ? 'delivered' : notification.status;

    return {
      id: notification.id,
      status,
      attempts: attempts.length,
      channels,
      delivered_at: deliveredAt ? deliveredAt.toISOString() : null
    };
  }

  private async publishToRabbit(
    notification: NotificationEntity,
    message: DispatchMessage,
    attemptNumber: number
  ): Promise<void> {
    const exchange = this.configService.getOrThrow<string>('dispatch.exchange', { infer: true });
    const routingKey = this.configService.getOrThrow<string>('dispatch.routingKey', { infer: true });

    try {
      await this.amqpConnection.publish(exchange, routingKey, message, {
        persistent: true
      });
      await this.recordAttempt(notification.id, attemptNumber, 'rabbitmq', NotificationDeliveryAttemptStatus.SUCCESS, {
        exchange,
        routingKey
      });
      await this.notificationsRepository.update(notification.id, {
        status: NotificationStatus.QUEUED
      });
    } catch (error) {
      await this.recordAttempt(
        notification.id,
        attemptNumber,
        'rabbitmq',
        NotificationDeliveryAttemptStatus.FAILURE,
        {
          exchange,
          routingKey
        },
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  private async publishToRedis(
    notification: NotificationEntity,
    message: DispatchMessage,
    attemptNumber: number
  ): Promise<void> {
    const channel = this.configService.getOrThrow<string>('dispatch.redisChannel', { infer: true });
    const client = this.redisService.getOrThrow();

    try {
      await client.publish(channel, JSON.stringify(message));
      await this.recordAttempt(notification.id, attemptNumber, 'redis', NotificationDeliveryAttemptStatus.SUCCESS, {
        channel
      });
    } catch (error) {
      await this.recordAttempt(
        notification.id,
        attemptNumber,
        'redis',
        NotificationDeliveryAttemptStatus.FAILURE,
        {
          channel
        },
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  private async dispatchInternally(
    dto: CreateNotificationDto,
    notification: NotificationEntity,
    attemptNumber: number
  ): Promise<void> {
    const chatId = dto.recipients.find((recipient) => recipient.telegramId)?.telegramId;
    const payload: IncomingNotificationDto['payload'] = {
      ...dto.payload,
      notificationId: notification.id,
      recipients: dto.recipients,
      channelOverrides: dto.channelOverrides ?? []
    };

    try {
      await this.notificationEventsService.handleIncoming({
        eventType: dto.eventKey,
        payload,
        chatId
      });
      await this.recordAttempt(
        notification.id,
        attemptNumber,
        'events-service',
        NotificationDeliveryAttemptStatus.SUCCESS,
        {
          chatId: chatId ?? null
        }
      );
    } catch (error) {
      await this.recordAttempt(
        notification.id,
        attemptNumber,
        'events-service',
        NotificationDeliveryAttemptStatus.FAILURE,
        {
          chatId: chatId ?? null
        },
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  private async recordAttempt(
    notificationId: string,
    attemptNumber: number,
    channel: string,
    status: NotificationDeliveryAttemptStatus,
    metadata: Record<string, unknown>,
    error?: string
  ): Promise<void> {
    const attempt = this.attemptsRepository.create({
      id: randomUUID(),
      notificationId,
      attemptNumber,
      channel,
      status,
      metadata,
      error: error ?? null
    });

    await this.attemptsRepository.save(attempt);
    await this.notificationsRepository.update(notificationId, {
      attemptsCount: attemptNumber,
      lastAttemptAt: new Date(),
      lastError: status === NotificationDeliveryAttemptStatus.FAILURE ? error ?? null : null
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const { code } = error as QueryFailedError & { code?: string };
    return code === '23505';
  }

  private async executeWithRetry(
    channel: string,
    operation: () => Promise<void>
  ): Promise<void> {
    const { maxAttempts, delayMs } = this.retryOptions;
    let attempt = 0;
    let lastError: unknown;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        await operation();
        return;
      } catch (error) {
        lastError = error;
        if (attempt >= maxAttempts) {
          break;
        }

        const message =
          error instanceof Error ? error.message : 'dispatch_retry_failed';
        this.logger.warn(
          `Channel ${channel} attempt ${attempt} failed: ${message}. Retrying in ${delayMs}ms.`
        );

        if (delayMs > 0) {
          await this.wait(delayMs);
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError));
  }

  private async wait(delayMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
