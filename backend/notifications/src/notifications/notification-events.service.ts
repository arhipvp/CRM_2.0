import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEventEntity } from './notification-event.entity';
import { NotificationStreamService } from './notification-stream.service';
import { TelegramService, TelegramSendResult } from './telegram.service';
import { IncomingNotificationDto } from './dto/incoming-notification.dto';
import {
  TelegramDeliveryWebhookDto,
  TelegramDeliveryWebhookStatus
} from './dto/telegram-delivery-webhook.dto';

@Injectable()
export class NotificationEventsService {
  private readonly logger = new Logger(NotificationEventsService.name);

  constructor(
    @InjectRepository(NotificationEventEntity)
    private readonly repository: Repository<NotificationEventEntity>,
    private readonly stream: NotificationStreamService,
    private readonly telegram: TelegramService
  ) {}

  async handleIncoming(dto: IncomingNotificationDto): Promise<void> {
    const entity = this.repository.create({
      eventType: dto.eventType,
      payload: dto.payload
    });

    await this.repository.save(entity);

    this.stream.publish(dto.eventType, dto.payload);

    const sendResult = await this.telegram.send({
      chatId: dto.chatId,
      message: this.composeTelegramMessage(dto)
    });

    await this.handleSendResult(entity.id, sendResult);

    this.logger.log(`Notification ${entity.id} processed.`);
  }

  async handleTelegramDeliveryUpdate(dto: TelegramDeliveryWebhookDto): Promise<void> {
    const entity = await this.repository.findOne({
      where: { telegramMessageId: dto.messageId }
    });

    if (!entity) {
      this.logger.warn(
        `Received Telegram delivery status for unknown message ${dto.messageId}.`
      );
      return;
    }

    const occurredAt = new Date(dto.occurredAt);

    await this.repository.update(entity.id, {
      deliveredToTelegram: dto.status === TelegramDeliveryWebhookStatus.Delivered,
      telegramDeliveryStatus: dto.status,
      telegramDeliveryReason: dto.reason ?? null,
      telegramDeliveryOccurredAt: occurredAt
    });

    const eventType =
      dto.status === TelegramDeliveryWebhookStatus.Delivered
        ? 'notifications.telegram.delivery'
        : 'notifications.telegram.error';

    this.stream.publish(eventType, {
      notificationId: entity.id,
      messageId: dto.messageId,
      status: dto.status,
      reason: dto.reason ?? null,
      occurredAt: occurredAt.toISOString()
    });
  }

  private composeTelegramMessage(dto: IncomingNotificationDto): string {
    const payloadPreview = JSON.stringify(dto.payload, null, 2);
    return `${dto.eventType}\n\n${payloadPreview}`;
  }

  private async handleSendResult(
    notificationId: string,
    sendResult: TelegramSendResult
  ): Promise<void> {
    const accepted = sendResult.accepted;
    const occurredAt = accepted ? new Date() : null;

    await this.repository.update(notificationId, {
      deliveredToTelegram: false,
      telegramMessageId: sendResult.messageId ?? null,
      telegramDeliveryStatus: accepted ? 'sent' : 'failed',
      telegramDeliveryReason: accepted ? null : sendResult.error ?? null,
      telegramDeliveryOccurredAt: occurredAt
    });

    if (accepted) {
      this.stream.publish('notifications.telegram.sent', {
        notificationId,
        messageId: sendResult.messageId ?? null,
        status: 'sent'
      });
      return;
    }

    if (sendResult.error) {
      this.stream.publish('notifications.telegram.error', {
        notificationId,
        messageId: sendResult.messageId ?? null,
        status: 'failed',
        reason: sendResult.error
      });
    }

    throw new InternalServerErrorException('notification_dispatch_failed');
  }
}
