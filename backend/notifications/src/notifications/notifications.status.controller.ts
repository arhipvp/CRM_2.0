import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationStatusResponse } from './dto/notification-status.response';

@Controller('v1/notifications')
export class NotificationsStatusController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get(':id')
  async getStatus(
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<NotificationStatusResponse> {
    const result = await this.notificationsService.getStatus(id);

    if (!result) {
      throw new NotFoundException('notification_not_found');
    }

    return result;
  }
}
