import { Controller, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { NotificationStreamService } from './notification-stream.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly stream: NotificationStreamService) {}

  @Sse('stream')
  streamNotifications(): Observable<MessageEvent> {
    return this.stream.asObservable();
  }
}
