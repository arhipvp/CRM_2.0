import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NotificationsConfiguration } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });
  const appLogger = new Logger('NotificationsService');
  app.useLogger(appLogger);
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true
      },
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'validation_error',
          message: 'Request validation failed.',
          errors
        })
    })
  );

  app.setGlobalPrefix('api');

  const configService = app.get(ConfigService<NotificationsConfiguration>);
  const host = configService.get<string>('http.host', { infer: true }) ?? '0.0.0.0';
  const port = configService.get<number>('http.port', { infer: true }) ?? 3050;

  await app.listen(port, host);

  const logger = new Logger('Bootstrap');
  logger.log(`Notifications service is listening on http://${host}:${port}`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start notifications service', error);
  process.exit(1);
});
