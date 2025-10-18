import { INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrapWorker() {
  const appContext = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true
  });

  const configService = appContext.get(ConfigService);
  const workerEnabled = configService.get<boolean>('tasks.scheduling.workerEnabled', false);

  if (!workerEnabled) {
    Logger.warn('Worker launched with TASKS_WORKER_ENABLED=false; no delayed tasks will be processed.', 'TasksWorker');
  } else {
    Logger.log('Tasks worker started and polling delayed tasks and reminders queues.', 'TasksWorker');
  }

  const app = appContext as unknown as INestApplication;

  await app.enableShutdownHooks();
}

bootstrapWorker().catch((error) => {
  Logger.error('Failed to bootstrap Tasks worker', error);
  process.exit(1);
});
