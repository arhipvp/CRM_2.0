import { RedisModule as NestRedisModule } from '@nestjs-modules/ioredis';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    NestRedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: configService.get<string>('tasks.redis.url') ?? 'redis://localhost:6379/6',
        options: {
          lazyConnect: true,
          maxRetriesPerRequest: null
        }
      })
    })
  ],
  exports: [NestRedisModule]
})
export class RedisModule {}
