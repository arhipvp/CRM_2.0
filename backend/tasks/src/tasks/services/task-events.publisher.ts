import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TaskEntity } from '../entities/task.entity';
import { TaskReminderEntity } from '../entities/task-reminder.entity';
import { randomUUID } from 'crypto';
import { TaskStatusCode } from '../constants/task-status.constants';

@Injectable()
export class TaskEventsPublisher {
  private readonly logger = new Logger(TaskEventsPublisher.name);
  private readonly exchange: string;
  private readonly source: string;
  private readonly routingKeys: {
    taskCreated: string;
    taskStatusChanged: string;
    taskReminder: string;
  };

  constructor(
    private readonly amqpConnection: AmqpConnection,
    configService: ConfigService
  ) {
    this.exchange = configService.get<string>('tasks.rabbitmq.events.exchange', 'tasks.events');
    this.source = configService.get<string>('tasks.rabbitmq.events.source', 'tasks.service');
    this.routingKeys = {
      taskCreated: configService.get<string>(
        'tasks.rabbitmq.events.routingKeys.taskCreated',
        'task.created'
      ),
      taskStatusChanged: configService.get<string>(
        'tasks.rabbitmq.events.routingKeys.taskStatusChanged',
        'task.status.changed'
      ),
      taskReminder: configService.get<string>(
        'tasks.rabbitmq.events.routingKeys.taskReminder',
        'task.reminder'
      )
    };
  }

  async taskCreated(task: TaskEntity) {
    await this.publish(
      this.routingKeys.taskCreated,
      'tasks.task.created',
      this.mapTaskCreatedData(task)
    );
  }

  async taskStatusChanged(task: TaskEntity, previousStatus: TaskStatusCode) {
    if (previousStatus === task.statusCode) {
      return;
    }

    await this.publish(
      this.routingKeys.taskStatusChanged,
      'tasks.task.status_changed',
      this.mapTaskStatusChanged(task, previousStatus)
    );
  }

  async taskReminder(reminder: TaskReminderEntity) {
    await this.publish(this.routingKeys.taskReminder, 'tasks.task.reminder', {
      task_id: reminder.taskId,
      remind_at: reminder.remindAt.toISOString(),
      channel: reminder.channel
    });
  }

  private mapTaskCreatedData(task: TaskEntity): Record<string, unknown> {
    const payload = (task.payload ?? {}) as Record<string, unknown>;

    return {
      task_id: task.id,
      subject: task.title,
      assignee_id: this.extractString(payload, ['assigneeId', 'assignee_id']),
      author_id: this.extractString(payload, ['authorId', 'author_id']),
      due_date: task.dueAt?.toISOString() ?? null,
      scheduled_for: task.scheduledFor?.toISOString() ?? null,
      status: task.statusCode,
      context: this.extractContext(payload)
    };
  }

  private mapTaskStatusChanged(
    task: TaskEntity,
    previousStatus: TaskStatusCode
  ): Record<string, unknown> {
    return {
      task_id: task.id,
      old_status: previousStatus,
      new_status: task.statusCode,
      changed_at: task.updatedAt?.toISOString() ?? new Date().toISOString()
    };
  }

  private extractString(
    payload: Record<string, unknown>,
    keys: string[]
  ): string | null {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return null;
  }

  private extractContext(payload: Record<string, unknown>): Record<string, unknown> | null {
    const contextValue = payload['context'];
    const context: Record<string, unknown> = {};

    if (contextValue && typeof contextValue === 'object' && !Array.isArray(contextValue)) {
      Object.entries(contextValue as Record<string, unknown>).forEach(([key, value]) => {
        context[this.toSnakeCase(key)] = value;
      });
    }

    const dealId = this.extractString(payload, ['dealId', 'deal_id']);
    const clientId = this.extractString(payload, ['clientId', 'client_id']);
    const policyId = this.extractString(payload, ['policyId', 'policy_id']);

    if (dealId) {
      context['deal_id'] = dealId;
    }
    if (clientId) {
      context['client_id'] = clientId;
    }
    if (policyId) {
      context['policy_id'] = policyId;
    }

    return Object.keys(context).length > 0 ? context : null;
  }

  private toSnakeCase(value: string): string {
    return value
      .replace(/[A-Z]+/g, (match) => `_${match.toLowerCase()}`)
      .replace(/[-\s]+/g, '_')
      .replace(/^_+/, '');
  }

  private async publish(routingKey: string, type: string, data: Record<string, unknown>) {
    try {
      await this.amqpConnection.publish(
        this.exchange,
        routingKey,
        this.createEvent(type, data),
        { headers: { 'ce-specversion': '1.0' } }
      );
    } catch (error) {
      this.logger.warn(`Failed to emit ${type} event: ${error}`);
    }
  }

  private createEvent(type: string, data: Record<string, unknown>) {
    return {
      id: randomUUID(),
      source: this.source,
      type,
      time: new Date().toISOString(),
      data
    };
  }
}
