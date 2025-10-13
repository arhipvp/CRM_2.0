import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DelayedTasksProcessor } from './delayed-tasks.processor';
import { TaskReminderProcessor } from '../tasks/services/task-reminder-processor.service';

@Injectable()
export class WorkerRegistrarService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerRegistrarService.name);
  private delayedInterval?: NodeJS.Timeout;
  private remindersInterval?: NodeJS.Timeout;
  private remindersProcessing = false;

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService,
    private readonly processor: DelayedTasksProcessor,
    private readonly reminderProcessor: TaskReminderProcessor
  ) {}

  onModuleInit() {
    const enabled = this.configService.get<boolean>('tasks.scheduling.workerEnabled', false);
    if (!enabled) {
      this.logger.debug('Tasks worker disabled by configuration.');
      return;
    }
    const pollInterval = this.configService.get<number>('tasks.scheduling.pollIntervalMs', 5000);
    this.delayedInterval = setInterval(async () => {
      try {
        const processed = await this.processor.processDueTasks();
        if (processed > 0) {
          this.logger.log(`Activated ${processed} scheduled tasks.`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to process delayed tasks: ${(error as Error).message}`,
          error as Error
        );
      }
    }, pollInterval);
    this.schedulerRegistry.addInterval('tasks-delayed-poll', this.delayedInterval);
    this.logger.log(`Delayed task worker started with interval ${pollInterval} ms.`);

    const remindersInterval = this.configService.get<number>('tasks.reminders.pollIntervalMs', 5000);
    this.remindersInterval = setInterval(async () => {
      if (this.remindersProcessing) {
        this.logger.warn('Previous reminder poll is still running, skipping this iteration.');
        return;
      }

      this.remindersProcessing = true;
      try {
        const processed = await this.reminderProcessor.processDueReminders();
        if (processed > 0) {
          this.logger.log(`Published ${processed} task reminder event(s).`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to process task reminders: ${(error as Error).message}`,
          error as Error
        );
      } finally {
        this.remindersProcessing = false;
      }
    }, remindersInterval);
    this.schedulerRegistry.addInterval('tasks-reminders-poll', this.remindersInterval);
    this.logger.log(`Task reminder worker started with interval ${remindersInterval} ms.`);
  }

  onModuleDestroy() {
    if (this.delayedInterval) {
      clearInterval(this.delayedInterval);
      this.schedulerRegistry.deleteInterval('tasks-delayed-poll');
    }
    if (this.remindersInterval) {
      clearInterval(this.remindersInterval);
      this.schedulerRegistry.deleteInterval('tasks-reminders-poll');
    }
  }
}
