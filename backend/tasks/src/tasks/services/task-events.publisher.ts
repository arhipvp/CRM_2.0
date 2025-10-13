import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { TASKS_EVENTS_CLIENT } from '../../messaging/constants';
import { TaskEntity } from '../entities/task.entity';

@Injectable()
export class TaskEventsPublisher {
  private readonly logger = new Logger(TaskEventsPublisher.name);

  constructor(
    @Inject(TASKS_EVENTS_CLIENT)
    private readonly client: ClientProxy
  ) {}

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
      await this.client.connect();
      await lastValueFrom(
        this.client.emit(pattern, {
          id: task.id,
          title: task.title,
          status: task.statusCode,
          dueAt: task.dueAt?.toISOString() ?? null,
          scheduledFor: task.scheduledFor?.toISOString() ?? null,
          completedAt: task.completedAt?.toISOString() ?? null,
          updatedAt: task.updatedAt.toISOString()
        })
      );
    } catch (error) {
      this.logger.warn(`Failed to emit ${pattern} event for task ${task.id}: ${error}`);
    }
  }
}
