import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DelayedTasksProcessor } from './delayed-tasks.processor';

@Injectable()
export class WorkerRegistrarService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerRegistrarService.name);
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService,
    private readonly processor: DelayedTasksProcessor
  ) {}

  onModuleInit() {
    const enabled = this.configService.get<boolean>('tasks.scheduling.workerEnabled', false);
    if (!enabled) {
      this.logger.debug('Delayed task worker disabled by configuration.');
      return;
    }
    const pollInterval = this.configService.get<number>('tasks.scheduling.pollIntervalMs', 5000);
    this.interval = setInterval(async () => {
      const processed = await this.processor.processDueTasks();
      if (processed > 0) {
        this.logger.log(`Activated ${processed} scheduled tasks.`);
      }
    }, pollInterval);
    this.schedulerRegistry.addInterval('tasks-delayed-poll', this.interval);
    this.logger.log(`Delayed task worker started with interval ${pollInterval} ms.`);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.schedulerRegistry.deleteInterval('tasks-delayed-poll');
    }
  }
}
