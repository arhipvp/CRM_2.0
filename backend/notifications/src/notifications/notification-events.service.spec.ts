import type { Repository } from 'typeorm';
import { NotificationEventsService } from './notification-events.service';
import { NotificationEventEntity } from './notification-event.entity';
import { NotificationStreamService } from './notification-stream.service';
import { TelegramService } from './telegram.service';
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
