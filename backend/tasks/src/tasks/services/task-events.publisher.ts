import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TaskEntity } from '../entities/task.entity';
import { TaskReminderEntity } from '../entities/task-reminder.entity';

@Injectable()
export class TaskEventsPublisher {
  private readonly logger = new Logger(TaskEventsPublisher.name);
  private readonly exchange: string;
  private readonly routingKey: string;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    configService: ConfigService
  ) {
    this.exchange = configService.get<string>('tasks.rabbitmq.eventsExchange', 'tasks.events');
    this.routingKey = configService.get<string>('tasks.rabbitmq.eventsRoutingKey', 'tasks.event');
  }

  async taskCreated(task: TaskEntity) {
    await this.publish('tasks.created', this.mapTaskPayload(task));
  }

  async taskScheduled(task: TaskEntity) {
    await this.publish('tasks.scheduled', this.mapTaskPayload(task));
  }

  async taskReady(task: TaskEntity) {
    await this.publish('tasks.ready', this.mapTaskPayload(task));
  }

  async taskCompleted(task: TaskEntity) {
    await this.publish('tasks.completed', this.mapTaskPayload(task));
  }

  async taskReminder(reminder: TaskReminderEntity) {
    await this.publish('tasks.reminder', {
      taskId: reminder.taskId,
      remindAt: reminder.remindAt.toISOString(),
      channel: reminder.channel
    });
  }

  private mapTaskPayload(task: TaskEntity) {
    return {
      id: task.id,
      title: task.title,
      status: task.statusCode,
      dueAt: task.dueAt?.toISOString() ?? null,
      scheduledFor: task.scheduledFor?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      updatedAt: task.updatedAt.toISOString()
    };
  }

  private async publish(pattern: string, payload: unknown) {
    try {
      await this.amqpConnection.publish(this.exchange, this.routingKey, {
        event: pattern,
        payload,
        occurredAt: new Date().toISOString()
      });
    } catch (error) {
      this.logger.warn(`Failed to emit ${pattern} event: ${error}`);
    }
  }
}
