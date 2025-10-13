import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const logger = new Logger('DocumentsWorker');
  logger.log('Documents worker started');
  return app;
}

bootstrapWorker().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Worker failed to start', error);
  process.exit(1);
});
