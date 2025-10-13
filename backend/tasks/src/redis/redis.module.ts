import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { TASKS_REDIS_CLIENT } from './constants';

@Module({
  providers: [
    {
      provide: TASKS_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('tasks.redis.url');
        return new Redis(url ?? 'redis://localhost:6379/6', {
          lazyConnect: true,
          maxRetriesPerRequest: null
        });
      }
    }
  ],
  exports: [TASKS_REDIS_CLIENT]
})
export class RedisModule {}
