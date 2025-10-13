import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('v1/notifications')
export class NotificationsDispatchController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(
    @Body() dto: CreateNotificationDto
  ): Promise<{ notification_id: string }> {
    const notification = await this.notificationsService.enqueue(dto);
    return { notification_id: notification.id };
  }
}
