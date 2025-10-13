import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskReminderEntity } from '../entities/task-reminder.entity';
import { TaskReminderQueueService } from './task-reminder-queue.service';
import { TaskEventsPublisher } from './task-events.publisher';

@Injectable()
export class TaskReminderProcessor {
  private readonly logger = new Logger(TaskReminderProcessor.name);

  constructor(
    private readonly queue: TaskReminderQueueService,
    @InjectRepository(TaskReminderEntity)
    private readonly reminderRepository: Repository<TaskReminderEntity>,
    private readonly eventsPublisher: TaskEventsPublisher,
    private readonly configService: ConfigService
  ) {}

  async processDueReminders(): Promise<number> {
    const now = Date.now();
    const batchSize = this.configService.get<number>('tasks.scheduling.batchSize', 100);
    const dueReminders = await this.queue.claimDue(now, batchSize);

    let processed = 0;

    for (const reminder of dueReminders) {
      let entity: TaskReminderEntity | null = null;

      try {
        entity = await this.reminderRepository.findOne({ where: { id: reminder.id } });

        if (!entity) {
          this.logger.warn(`Reminder ${reminder.id} no longer exists; skipping.`);
          continue;
        }

        await this.eventsPublisher.taskReminder(entity);
        processed += 1;
      } catch (error) {
        this.logger.error(`Error while processing reminder ${reminder.id}: ${(error as Error).message}`, error as Error);
        await this.reschedule(reminder.id, reminder.score);
      }
    }

    return processed;
  }

  private async reschedule(reminderId: string, originalScore: number): Promise<void> {
    const pollInterval = this.configService.get<number>('tasks.reminders.pollIntervalMs', 5000);
    const retryDelay = Math.max(pollInterval, 1000);
    const nextAttempt = Math.max(originalScore, Date.now() + retryDelay);

    try {
      await this.queue.schedule(reminderId, new Date(nextAttempt));
      this.logger.debug(`Reminder ${reminderId} rescheduled for retry at ${new Date(nextAttempt).toISOString()}.`);
    } catch (error) {
      this.logger.error(
        `Failed to reschedule reminder ${reminderId} for retry: ${(error as Error).message}`,
        error as Error
      );
    }
  }
}
