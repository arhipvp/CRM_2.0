import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEventEntity } from './notification-event.entity';
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
    const entity = this.repository.create({
      eventType: dto.eventType,
      payload: dto.payload
    });

    await this.repository.save(entity);

    this.stream.publish(dto.eventType, dto.payload);

    const delivered = await this.telegram.send({
      chatId: dto.chatId,
      message: this.composeTelegramMessage(dto)
    });

    if (delivered) {
      await this.repository.update(entity.id, { deliveredToTelegram: true });
    }

    this.logger.log(`Notification ${entity.id} processed.`);
  }

  private composeTelegramMessage(dto: IncomingNotificationDto): string {
    const payloadPreview = JSON.stringify(dto.payload, null, 2);
    return `${dto.eventType}\n\n${payloadPreview}`;
  }
}
