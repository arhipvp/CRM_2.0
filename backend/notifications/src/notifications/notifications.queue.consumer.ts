import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import configuration from '../config/configuration';
import { NotificationEventsService } from './notification-events.service';
import { IncomingNotificationDto } from './dto/incoming-notification.dto';

const config = configuration();

@Injectable()
export class NotificationsQueueConsumer {
  private readonly logger = new Logger(NotificationsQueueConsumer.name);

  constructor(private readonly eventsService: NotificationEventsService) {}

  @RabbitSubscribe({
    exchange: config.rabbitmq.exchange,
    routingKey: config.rabbitmq.routingKey,
    queue: config.rabbitmq.queue,
    queueOptions: config.rabbitmq.queueOptions
  })
  public async handleIncoming(message: IncomingNotificationDto) {
    this.logger.debug(`Received event from queue: ${message.eventType}`);
    await this.eventsService.handleIncoming(message);
  }
}
