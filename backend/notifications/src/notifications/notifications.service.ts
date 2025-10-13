import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ConfigService } from '@nestjs/config';
import { NotificationsConfiguration } from '../config/configuration';
import {
  NotificationDeliveryAttemptEntity,
  NotificationDeliveryAttemptStatus
} from './notification-delivery-attempt.entity';
import {
  NotificationEntity,
  NotificationStatus
} from './notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationEventsService } from './notification-events.service';
import { IncomingNotificationDto } from './dto/incoming-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly exchange: string;
  private readonly routingKey: string;
  private readonly redisChannel: string;

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    @InjectRepository(NotificationDeliveryAttemptEntity)
    private readonly attemptsRepository: Repository<NotificationDeliveryAttemptEntity>,
    private readonly amqpConnection: AmqpConnection,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService<NotificationsConfiguration>,
    private readonly notificationEventsService: NotificationEventsService
  ) {
    this.exchange = this.configService.get<string>('rabbitmq.exchange', {
      infer: true
    })!;
    this.routingKey = this.configService.get<string>('rabbitmq.outgoingRoutingKey', {
      infer: true
    })!;
    this.redisChannel = this.configService.get<string>('redis.notificationsChannel', {
      infer: true
    })!;
  }

  async create(dto: CreateNotificationDto): Promise<NotificationEntity> {
    if (dto.deduplicationKey) {
      const existing = await this.notificationsRepository.findOne({
        where: { deduplicationKey: dto.deduplicationKey }
      });
      if (existing) {
        throw new ConflictException({
          code: 'duplicate_notification',
          message: 'Notification with the provided deduplication key already exists.',
          notificationId: existing.id
        });
      }
    }

    const notification = this.notificationsRepository.create({
      eventKey: dto.eventKey,
      recipients: dto.recipients,
      payload: dto.payload,
      channelOverrides: dto.channelOverrides,
      deduplicationKey: dto.deduplicationKey,
      status: NotificationStatus.Pending
    });

    await this.notificationsRepository.save(notification);

    await this.logAttempt(notification, 'rabbitmq', NotificationDeliveryAttemptStatus.Queued);
    await this.logAttempt(notification, 'redis', NotificationDeliveryAttemptStatus.Queued);

    await this.publishToRabbit(notification).catch(async (error) => {
      await this.failNotification(notification, 'rabbitmq', error);
      throw error;
    });

    await this.publishToRedis(notification).catch(async (error) => {
      await this.failNotification(notification, 'redis', error);
      throw error;
    });

    await this.logAttempt(
      notification,
      'events_service',
      NotificationDeliveryAttemptStatus.Queued
    );

    await this.dispatchToEventsService(notification, dto).catch(async (error) => {
      await this.failNotification(notification, 'events_service', error);
      throw error;
    });

    await this.notificationsRepository.update(notification.id, {
      status: NotificationStatus.Processing
    });

    return await this.notificationsRepository.findOneByOrFail({ id: notification.id });
  }

  private async publishToRabbit(notification: NotificationEntity): Promise<void> {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        this.routingKey,
        {
          notificationId: notification.id,
          eventKey: notification.eventKey,
          payload: notification.payload,
          recipients: notification.recipients,
          channelOverrides: notification.channelOverrides
        },
        { persistent: true }
      );

      await this.logAttempt(notification, 'rabbitmq', NotificationDeliveryAttemptStatus.Sent, {
        exchange: this.exchange,
        routingKey: this.routingKey
      });
    } catch (error) {
      this.logger.error('Failed to publish notification to RabbitMQ', error as Error);
      throw new InternalServerErrorException({
        code: 'notification_publish_failed',
        message: 'Failed to publish notification to RabbitMQ.'
      });
    }
  }

  private async publishToRedis(notification: NotificationEntity): Promise<void> {
    try {
      const client = this.redisService.getOrThrow();
      await client.publish(
        this.redisChannel,
        JSON.stringify({
          id: notification.id,
          eventKey: notification.eventKey,
          payload: notification.payload,
          recipients: notification.recipients
        })
      );

      await this.logAttempt(notification, 'redis', NotificationDeliveryAttemptStatus.Sent, {
        channel: this.redisChannel
      });
    } catch (error) {
      this.logger.error('Failed to publish notification to Redis', error as Error);
      throw new InternalServerErrorException({
        code: 'notification_redis_failed',
        message: 'Failed to publish notification to Redis.'
      });
    }
  }

  private async dispatchToEventsService(
    notification: NotificationEntity,
    dto: CreateNotificationDto
  ): Promise<void> {
    const recipients = Array.isArray(dto.recipients) ? dto.recipients : [];
    for (const recipient of recipients) {
      const incoming: IncomingNotificationDto = {
        eventType: dto.eventKey,
        payload: {
          ...dto.payload,
          recipient
        },
        chatId: recipient.telegramId
      };
      await this.notificationEventsService.handleIncoming(incoming);
    }

    await this.logAttempt(notification, 'events_service', NotificationDeliveryAttemptStatus.Sent, {
      recipients: recipients.length
    });
  }

  private async logAttempt(
    notification: NotificationEntity,
    channel: string,
    status: NotificationDeliveryAttemptStatus,
    metadata?: Record<string, unknown>,
    error?: string
  ): Promise<void> {
    const attempt = this.attemptsRepository.create({
      notification,
      channel,
      status,
      metadata,
      error
    });
    await this.attemptsRepository.save(attempt);
  }

  private async failNotification(
    notification: NotificationEntity,
    channel: string,
    error: unknown
  ): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await this.logAttempt(
      notification,
      channel,
      NotificationDeliveryAttemptStatus.Failed,
      undefined,
      message
    );
    await this.notificationsRepository.update(notification.id, {
      status: NotificationStatus.Failed
    });
  }
}
