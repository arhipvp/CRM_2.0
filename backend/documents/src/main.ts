import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { DocumentsConfiguration } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidUnknownValues: false,
      exceptionFactory: (errors) =>
        new BadRequestException({
          statusCode: 400,
          code: 'validation_error',
          message: 'Ошибка валидации',
          errors: errors.map((error) => ({
            field: error.property,
            constraints: error.constraints,
          })),
        }),
    }),
  );

  const config = app.get<ConfigService<DocumentsConfiguration, true>>(ConfigService);
  const port = config.get('port', { infer: true });
  await app.listen(port);
}

bootstrap();
