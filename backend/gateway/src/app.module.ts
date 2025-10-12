import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from './http/health/health.module';
import { HttpConfigModule } from './config/http-config.module';
import { SseModule } from './sse/sse.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : undefined,
      load: []
    }),
    HttpConfigModule,
    HealthModule,
    SseModule
  ]
})
export class AppModule {}
