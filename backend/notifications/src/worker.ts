import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { INestApplication, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrapWorker() {
  const appContext = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true
  });
  const logger = new Logger('NotificationsWorker');
  const app = appContext as unknown as INestApplication;
  app.enableShutdownHooks();
  logger.log('Notifications worker started. Listening for message broker events.');
}

bootstrapWorker().catch((error) => {
  const logger = new Logger('NotificationsWorker');
  logger.error('Failed to start worker context', error);
  process.exit(1);
});
