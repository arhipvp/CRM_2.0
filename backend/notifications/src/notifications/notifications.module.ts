import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationEventEntity } from './notification-event.entity';
import { NotificationEventsService } from './notification-events.service';
import { NotificationsQueueConsumer } from './notifications.queue.consumer';
import { TelegramService } from './telegram.service';
import { NotificationsIngressController } from './notifications.ingress.controller';
import { TelegramDeliveryController } from './telegram-delivery.controller';
import { NotificationsDispatchController } from './notifications.dispatch.controller';
import { NotificationsStatusController } from './notifications.status.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEntity } from './notification.entity';
import { NotificationDeliveryAttemptEntity } from './notification-delivery-attempt.entity';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [
    MessagingModule,
    TypeOrmModule.forFeature([
      NotificationEventEntity,
      NotificationEntity,
      NotificationDeliveryAttemptEntity
    ])
  ],
  controllers: [
    NotificationsController,
    NotificationsIngressController,
    TelegramDeliveryController,
    NotificationsDispatchController,
    NotificationsStatusController
  ],
  providers: [
    NotificationStreamService,
    NotificationEventsService,
    NotificationsQueueConsumer,
    TelegramService,
    NotificationsService
  ]
})
export class NotificationsModule {}
