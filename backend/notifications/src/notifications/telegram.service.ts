import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type TelegramPayload = {
  chatId?: string;
  message: string;
};

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly enabled: boolean;
  private readonly mock: boolean;
  private readonly botToken: string | null;
  private readonly defaultChatId: string | null;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('telegram.enabled', { infer: true }) ?? false;
    this.mock = this.configService.get<boolean>('telegram.mock', { infer: true }) ?? true;
    this.botToken = this.configService.get<string>('telegram.botToken', { infer: true }) ?? null;
    this.defaultChatId = this.configService.get<string>('telegram.defaultChatId', { infer: true }) ?? null;
  }

  async send(payload: TelegramPayload): Promise<boolean> {
    if (!this.enabled) {
      this.logger.debug('Telegram delivery disabled; skipping send.');
      return false;
    }

    const chatId = payload.chatId ?? this.defaultChatId;
    if (!chatId) {
      this.logger.warn('Telegram is enabled but no chat ID is configured.');
      return false;
    }

    if (!this.botToken) {
      this.logger.warn('Telegram is enabled but BOT token is missing.');
      return false;
    }

    const message = payload.message;

    if (this.mock) {
      this.logger.log(`Mock Telegram send to ${chatId}: ${message}`);
      return true;
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Telegram send failed: ${response.status} ${text}`);
      return false;
    }

    this.logger.log(`Sent Telegram notification to ${chatId}`);
    return true;
  }
}
