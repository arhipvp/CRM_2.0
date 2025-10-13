import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import type { NotificationsConfiguration } from '../config/configuration';
import { NotificationEventsService } from './notification-events.service';
import {
  TelegramDeliveryWebhookDto,
  TelegramDeliveryWebhookStatus
} from './dto/telegram-delivery-webhook.dto';
import { TelegramDeliveryController } from './telegram-delivery.controller';

describe('TelegramDeliveryController', () => {
  const secret = 'test-secret';
  const dto: TelegramDeliveryWebhookDto = {
    messageId: '123',
    status: TelegramDeliveryWebhookStatus.Delivered,
    occurredAt: new Date().toISOString()
  };

  let eventsService: NotificationEventsService;
  let configService: ConfigService<NotificationsConfiguration>;
  let controller: TelegramDeliveryController;

  beforeEach(() => {
    eventsService = {
      handleTelegramDeliveryUpdate: jest.fn()
    } as unknown as NotificationEventsService;

    const getMock = jest.fn((key: string) => {
      if (key === 'telegram.webhook.enabled') {
        return true;
      }
      if (key === 'telegram.webhook.secret') {
        return secret;
      }
      if (key === 'telegram.webhook.signatureHeader') {
        return 'x-telegram-signature';
      }
      return undefined;
    });

    configService = {
      get: getMock
    } as unknown as ConfigService<NotificationsConfiguration>;

    controller = new TelegramDeliveryController(configService, eventsService);
  });

  it('accepts requests with a valid signature', async () => {
    const signature = createHmac('sha256', secret)
      .update(JSON.stringify(dto))
      .digest('hex');

    const result = await controller.handleDelivery(
      {
        'x-telegram-signature': signature
      },
      dto
    );

    expect(result).toEqual({ status: 'ok' });
    expect(eventsService.handleTelegramDeliveryUpdate).toHaveBeenCalledWith(dto);
  });

  it('rejects requests with an invalid signature', async () => {
    await expect(
      controller.handleDelivery(
        {
          'x-telegram-signature': 'invalid'
        },
        dto
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(eventsService.handleTelegramDeliveryUpdate).not.toHaveBeenCalled();
  });

  it('rejects requests when webhook is disabled', async () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'telegram.webhook.enabled') {
        return false;
      }
      if (key === 'telegram.webhook.signatureHeader') {
        return 'x-telegram-signature';
      }
      if (key === 'telegram.webhook.secret') {
        return secret;
      }
      return undefined;
    });

    await expect(
      controller.handleDelivery(
        {
          'x-telegram-signature': 'anything'
        },
        dto
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
