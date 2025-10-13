import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationEventEntity } from './notification-event.entity';
import { NotificationEventsService } from './notification-events.service';
import { NotificationsQueueConsumer } from './notifications.queue.consumer';
import { TelegramService } from './telegram.service';
import { NotificationsIngressController } from './notifications.ingress.controller';
import { NotificationsStatusController } from './notifications.status.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEventEntity])],
  controllers: [
    NotificationsController,
    NotificationsIngressController,
    NotificationsStatusController
  ],
  providers: [
    NotificationStreamService,
    NotificationEventsService,
    NotificationsQueueConsumer,
    TelegramService
  ]
})
export class NotificationsModule {}
