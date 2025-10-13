import { Body, Controller, Post } from '@nestjs/common';
import { NotificationEventsService } from './notification-events.service';
import { IncomingNotificationDto } from './dto/incoming-notification.dto';

@Controller('notifications')
export class NotificationsIngressController {
  constructor(private readonly eventsService: NotificationEventsService) {}

  @Post('events')
  async ingest(@Body() dto: IncomingNotificationDto): Promise<{ status: string }> {
    await this.eventsService.handleIncoming(dto);
    return { status: 'ok' };
  }
}
