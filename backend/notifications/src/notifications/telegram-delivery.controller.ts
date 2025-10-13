import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { NotificationsConfiguration } from '../config/configuration';
import { NotificationEventsService } from './notification-events.service';
import { TelegramDeliveryWebhookDto } from './dto/telegram-delivery-webhook.dto';

@Controller('v1/telegram')
export class TelegramDeliveryController {
  constructor(
    private readonly configService: ConfigService<NotificationsConfiguration>,
    private readonly eventsService: NotificationEventsService
  ) {}

  @Post('delivery')
  async handleDelivery(
    @Headers() headers: Record<string, string | string[]>,
    @Body() dto: TelegramDeliveryWebhookDto
  ): Promise<{ status: string }> {
    const enabled = this.configService.get<boolean>('telegram.webhook.enabled', {
      infer: true
    });
    const secret = this.configService.get<string | null>('telegram.webhook.secret', {
      infer: true
    });
    const signatureHeader =
      this.configService.get<string>('telegram.webhook.signatureHeader', {
        infer: true
      }) ?? 'x-telegram-signature';

    if (!enabled || !secret) {
      throw new ForbiddenException('telegram_webhook_disabled');
    }

    const signature = this.extractSignature(headers, signatureHeader);
    const payload = JSON.stringify(dto);
    const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');

    if (!this.signaturesEqual(signature, expectedSignature)) {
      throw new UnauthorizedException('invalid_signature');
    }

    await this.eventsService.handleTelegramDeliveryUpdate(dto);

    return { status: 'ok' };
  }

  private extractSignature(
    headers: Record<string, string | string[]>,
    headerName: string
  ): string {
    const headerKey = Object.keys(headers).find((key) => key.toLowerCase() === headerName.toLowerCase());
    const value = headerKey ? headers[headerKey] : undefined;
    if (!value) {
      throw new UnauthorizedException('missing_signature');
    }
    return Array.isArray(value) ? value[0] : value;
  }

  private signaturesEqual(signature: string, expected: string): boolean {
    const normalizedSignature = signature.trim().toLowerCase();
    const normalizedExpected = expected.trim().toLowerCase();
    const signatureBuffer = Buffer.from(normalizedSignature, 'utf8');
    const expectedBuffer = Buffer.from(normalizedExpected, 'utf8');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  }
}
