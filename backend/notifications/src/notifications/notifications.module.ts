import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationEventEntity } from './notification-event.entity';
import { NotificationEventsService } from './notification-events.service';
import { NotificationsQueueConsumer } from './notifications.queue.consumer';
import { TelegramService } from './telegram.service';
import { NotificationsIngressController } from './notifications.ingress.controller';
import { NotificationsApiController } from './notifications.api.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEntity } from './notification.entity';
import { NotificationDeliveryAttemptEntity } from './notification-delivery-attempt.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEventEntity,
      NotificationEntity,
      NotificationDeliveryAttemptEntity
    ])
  ],
  controllers: [
    NotificationsController,
    NotificationsIngressController,
    NotificationsApiController
  ],
  providers: [
    NotificationStreamService,
    NotificationEventsService,
    NotificationsService,
    NotificationsQueueConsumer,
    TelegramService
  ]
})
export class NotificationsModule {}
