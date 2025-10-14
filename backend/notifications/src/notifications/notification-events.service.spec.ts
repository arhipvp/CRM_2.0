import { InternalServerErrorException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { NotificationEventsService } from './notification-events.service';
import { NotificationEventEntity } from './notification-event.entity';
import { NotificationStreamService } from './notification-stream.service';
import { TelegramService } from './telegram.service';
import { IncomingNotificationDto } from './dto/incoming-notification.dto';
import {
  TelegramDeliveryWebhookDto,
  TelegramDeliveryWebhookStatus
} from './dto/telegram-delivery-webhook.dto';

describe('NotificationEventsService', () => {
  let repository: jest.Mocked<Repository<NotificationEventEntity>>;
  let stream: NotificationStreamService;
  let telegram: TelegramService;
  let service: NotificationEventsService;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn()
    } as unknown as jest.Mocked<Repository<NotificationEventEntity>>;

    stream = {
      publish: jest.fn()
    } as unknown as NotificationStreamService;

    telegram = {
      send: jest.fn()
    } as unknown as TelegramService;

    service = new NotificationEventsService(repository, stream, telegram);
  });

  describe('handleIncoming', () => {
    const incoming: IncomingNotificationDto = {
      eventType: 'deal.created',
      payload: { id: 'deal-1' },
      chatId: '1000'
    };

    it('throws and records failure when Telegram rejects the message', async () => {
      const entity = { id: 'event-1' } as NotificationEventEntity;
      (repository.create as jest.Mock).mockReturnValue(entity);
      (repository.save as jest.Mock).mockResolvedValue(entity);
      (telegram.send as jest.Mock).mockResolvedValue({
        accepted: false,
        error: 'bot disabled',
        messageId: undefined
      });

      const promise = service.handleIncoming(incoming);

      await expect(promise).rejects.toBeInstanceOf(InternalServerErrorException);
      await expect(promise).rejects.toMatchObject({
        response: expect.objectContaining({ message: 'notification_dispatch_failed' })
      });

      expect(repository.update).toHaveBeenCalledWith('event-1', {
        deliveredToTelegram: false,
        telegramMessageId: null,
        telegramDeliveryStatus: 'failed',
        telegramDeliveryReason: 'bot disabled',
        telegramDeliveryOccurredAt: null
      });
      expect(stream.publish).toHaveBeenCalledTimes(2);
      expect(stream.publish).toHaveBeenCalledWith('deal.created', incoming.payload);
      expect(stream.publish).toHaveBeenCalledWith('notifications.telegram.error', {
        notificationId: 'event-1',
        messageId: null,
        status: 'failed',
        reason: 'bot disabled'
      });
    });
  });

  describe('handleTelegramDeliveryUpdate', () => {
    const baseDto: TelegramDeliveryWebhookDto = {
      messageId: 'msg-1',
      status: TelegramDeliveryWebhookStatus.Delivered,
      occurredAt: '2024-03-01T12:00:00.000Z'
    };

    it('updates notification as delivered and publishes event', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue({ id: 'notif-1' });

      await service.handleTelegramDeliveryUpdate(baseDto);

      expect(repository.update).toHaveBeenCalledWith('notif-1', {
        deliveredToTelegram: true,
        telegramDeliveryStatus: TelegramDeliveryWebhookStatus.Delivered,
        telegramDeliveryReason: null,
        telegramDeliveryOccurredAt: new Date(baseDto.occurredAt)
      });

      expect(stream.publish).toHaveBeenCalledWith('notifications.telegram.delivery', {
        notificationId: 'notif-1',
        messageId: 'msg-1',
        status: TelegramDeliveryWebhookStatus.Delivered,
        reason: null,
        occurredAt: baseDto.occurredAt
      });
    });

    it('updates notification as failed and publishes error event', async () => {
      const dto: TelegramDeliveryWebhookDto = {
        ...baseDto,
        status: TelegramDeliveryWebhookStatus.Failed,
        reason: 'blocked by user'
      };

      (repository.findOne as jest.Mock).mockResolvedValue({ id: 'notif-2' });

      await service.handleTelegramDeliveryUpdate(dto);

      expect(repository.update).toHaveBeenCalledWith('notif-2', {
        deliveredToTelegram: false,
        telegramDeliveryStatus: TelegramDeliveryWebhookStatus.Failed,
        telegramDeliveryReason: 'blocked by user',
        telegramDeliveryOccurredAt: new Date(dto.occurredAt)
      });

      expect(stream.publish).toHaveBeenCalledWith('notifications.telegram.error', {
        notificationId: 'notif-2',
        messageId: 'msg-1',
        status: TelegramDeliveryWebhookStatus.Failed,
        reason: 'blocked by user',
        occurredAt: dto.occurredAt
      });
    });

    it('skips update when notification is unknown', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await service.handleTelegramDeliveryUpdate(baseDto);

      expect(repository.update).not.toHaveBeenCalled();
      expect(stream.publish).not.toHaveBeenCalled();
    });
  });
});
