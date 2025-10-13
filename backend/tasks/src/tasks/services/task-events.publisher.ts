import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TaskEntity } from '../entities/task.entity';

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
    await this.emit('tasks.created', task);
  }

  async taskScheduled(task: TaskEntity) {
    await this.emit('tasks.scheduled', task);
  }

  async taskReady(task: TaskEntity) {
    await this.emit('tasks.ready', task);
  }

  async taskCompleted(task: TaskEntity) {
    await this.emit('tasks.completed', task);
  }

  private async emit(pattern: string, task: TaskEntity) {
    try {
      await this.amqpConnection.publish(this.exchange, this.routingKey, {
        event: pattern,
        payload: {
          id: task.id,
          title: task.title,
          status: task.statusCode,
          dueAt: task.dueAt?.toISOString() ?? null,
          scheduledFor: task.scheduledFor?.toISOString() ?? null,
          completedAt: task.completedAt?.toISOString() ?? null,
          updatedAt: task.updatedAt.toISOString()
        },
        occurredAt: new Date().toISOString()
      });
    } catch (error) {
      this.logger.warn(`Failed to emit ${pattern} event for task ${task.id}: ${error}`);
    }
  }
}
