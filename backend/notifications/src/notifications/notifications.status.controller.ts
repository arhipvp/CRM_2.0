import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { NotificationEventsService } from './notification-events.service';

@Controller('v1/notifications')
export class NotificationsStatusController {
  constructor(private readonly eventsService: NotificationEventsService) {}

  @Get(':id')
  async getStatus(@Param('id') id: string) {
    const entity = await this.eventsService.getStatus(id);

    if (!entity) {
      throw new NotFoundException({
        error: 'notification_not_found',
        message: `Notification ${id} not found`
      });
    }

    return {
      id: entity.id,
      status: entity.status,
      attempts: entity.attempts,
      channels: entity.channels,
      delivered_at: entity.deliveredAt ? entity.deliveredAt.toISOString() : null
    };
  }
}
