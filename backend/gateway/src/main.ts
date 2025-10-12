import compression from 'compression';
import helmet from 'helmet';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });

  const logger = new Logger('Bootstrap');

  app.useLogger(logger);
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: true,
    credentials: true
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true }
    })
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('http.port', { infer: true }) ?? 8080;
  const host = configService.get<string>('http.host', { infer: true }) ?? '0.0.0.0';

  await app.listen(port, host);
  logger.log(`Gateway is listening on http://${host}:${port}`);
}

void bootstrap();
