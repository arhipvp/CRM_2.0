import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type TelegramPayload = {
  chatId?: string;
  message: string;
};

export interface TelegramSendResult {
  accepted: boolean;
  messageId?: string | null;
  error?: string;
}

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

  async send(payload: TelegramPayload): Promise<TelegramSendResult> {
    if (!this.enabled) {
      this.logger.debug('Telegram delivery disabled; skipping send.');
      return { accepted: false, error: 'telegram_disabled' };
    }

    const chatId = payload.chatId ?? this.defaultChatId;
    if (!chatId) {
      this.logger.warn('Telegram is enabled but no chat ID is configured.');
      return { accepted: false, error: 'missing_chat_id' };
    }

    if (!this.botToken) {
      this.logger.warn('Telegram is enabled but BOT token is missing.');
      return { accepted: false, error: 'missing_bot_token' };
    }

    const message = payload.message;

    if (this.mock) {
      const mockMessageId = `mock-${Date.now()}`;
      this.logger.log(`Mock Telegram send to ${chatId}: ${message}`);
      return { accepted: true, messageId: mockMessageId };
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    try {
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
        return {
          accepted: false,
          error: `telegram_http_${response.status}`
        };
      }

      const body = (await response.json()) as {
        ok: boolean;
        result?: { message_id?: number | string };
        description?: string;
      };

      if (!body.ok) {
        this.logger.error(`Telegram send returned ok=false: ${body.description ?? 'unknown error'}`);
        return {
          accepted: false,
          error: 'telegram_response_not_ok'
        };
      }

      const messageId = body.result?.message_id;
      this.logger.log(`Sent Telegram notification to ${chatId}`);
      return {
        accepted: true,
        messageId: messageId ? String(messageId) : null
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Telegram send threw an exception: ${errorMessage}`);
      return {
        accepted: false,
        error: 'telegram_request_failed'
      };
    }
  }
}
