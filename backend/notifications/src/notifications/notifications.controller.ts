import { Controller, Get, Header, MessageEvent, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { NotificationStreamService } from './notification-stream.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly stream: NotificationStreamService) {}

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Sse('stream')
  @Header('Cache-Control', 'no-store')
  @Header('X-Accel-Buffering', 'no')
  streamNotifications(): Observable<MessageEvent> {
    return this.stream.asObservable();
  }
}
