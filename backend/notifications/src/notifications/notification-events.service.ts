import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationEventEntity,
  NotificationStatus
} from './notification-event.entity';
import { NotificationStreamService } from './notification-stream.service';
import { TelegramService } from './telegram.service';
import { IncomingNotificationDto } from './dto/incoming-notification.dto';

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
    const channels = this.resolveChannels(dto);
    const entity = this.repository.create({
      eventType: dto.eventType,
      payload: dto.payload,
      status: NotificationStatus.PENDING,
      attempts: 0,
      channels
    });

    await this.repository.save(entity);

    await this.repository.update(entity.id, { status: NotificationStatus.PROCESSING });

    this.stream.publish(dto.eventType, dto.payload);

    let attempts = 0;
    let status = NotificationStatus.DELIVERED;
    let deliveredAt: Date | null = new Date();
    let deliveredToTelegram = false;

    if (channels.includes('telegram')) {
      attempts += 1;
      const delivered = await this.telegram.send({
        chatId: dto.chatId,
        message: this.composeTelegramMessage(dto)
      });

      deliveredToTelegram = delivered;
      if (!delivered) {
        status = NotificationStatus.FAILED;
        deliveredAt = null;
      }
    }

    if (status === NotificationStatus.DELIVERED && deliveredAt === null) {
      deliveredAt = new Date();
    }

    await this.repository.update(entity.id, {
      status,
      attempts,
      channels,
      deliveredToTelegram,
      deliveredAt
    });

    this.logger.log(`Notification ${entity.id} processed with status ${status}.`);
  }

  async getStatus(id: string): Promise<NotificationEventEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  private composeTelegramMessage(dto: IncomingNotificationDto): string {
    const payloadPreview = JSON.stringify(dto.payload, null, 2);
    return `${dto.eventType}\n\n${payloadPreview}`;
  }

  private resolveChannels(dto: IncomingNotificationDto): Array<'sse' | 'telegram'> {
    if (dto.channels && dto.channels.length > 0) {
      return Array.from(new Set(dto.channels)) as Array<'sse' | 'telegram'>;
    }

    if (dto.chatId) {
      return ['telegram'];
    }

    return ['sse'];
  }
}
