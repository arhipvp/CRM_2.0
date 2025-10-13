import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskReminderEntity } from '../entities/task-reminder.entity';
import { TaskReminderQueueService } from './task-reminder-queue.service';
import { TaskEventsPublisher } from './task-events.publisher';

const REMINDERS_INTERVAL_NAME = 'tasks-reminders-poll';

@Injectable()
export class TaskReminderProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskReminderProcessor.name);
  private interval?: NodeJS.Timeout;
  private processing = false;

  constructor(
    private readonly queue: TaskReminderQueueService,
    @InjectRepository(TaskReminderEntity)
    private readonly reminderRepository: Repository<TaskReminderEntity>,
    private readonly eventsPublisher: TaskEventsPublisher,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry
  ) {}

  onModuleInit() {
    const workerEnabled = this.configService.get<boolean>('tasks.scheduling.workerEnabled', false);
    if (!workerEnabled) {
      this.logger.debug('Task reminder processor disabled by configuration.');
      return;
    }

    const pollInterval = this.configService.get<number>('tasks.reminders.pollIntervalMs', 5000);
    this.interval = setInterval(async () => {
      if (this.processing) {
        this.logger.warn('Previous reminder poll is still running, skipping this iteration.');
        return;
      }

      this.processing = true;
      try {
        const processed = await this.processDueReminders();
        if (processed > 0) {
          this.logger.log(`Published ${processed} task reminder event(s).`);
        }
      } catch (error) {
        this.logger.error(`Failed to process task reminders: ${(error as Error).message}`, error as Error);
      } finally {
        this.processing = false;
      }
    }, pollInterval);

    this.schedulerRegistry.addInterval(REMINDERS_INTERVAL_NAME, this.interval);
    this.logger.log(`Task reminder processor started with interval ${pollInterval} ms.`);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.schedulerRegistry.deleteInterval(REMINDERS_INTERVAL_NAME);
    }
  }

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
