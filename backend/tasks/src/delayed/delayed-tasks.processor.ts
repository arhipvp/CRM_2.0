import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { ActivateScheduledTaskCommand } from '../tasks/commands/activate-scheduled-task.command';
import { DelayedTaskQueueService } from './delayed-task-queue.service';

@Injectable()
export class DelayedTasksProcessor {
  private readonly logger = new Logger(DelayedTasksProcessor.name);

  constructor(
    private readonly delayedQueue: DelayedTaskQueueService,
    private readonly commandBus: CommandBus,
    private readonly configService: ConfigService
  ) {}

  async processDueTasks(): Promise<number> {
    const batchSize = this.configService.get<number>('tasks.scheduling.batchSize', 100);
    const now = Date.now();
    const taskIds = await this.delayedQueue.pullDue(now, batchSize);
    for (const id of taskIds) {
      try {
        await this.commandBus.execute(new ActivateScheduledTaskCommand(id));
      } catch (error) {
        this.logger.error(`Failed to activate scheduled task ${id}: ${error}`);
      }
    }
    return taskIds.length;
  }
}
