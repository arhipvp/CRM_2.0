import { Global, Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import RedisClient from 'ioredis';

import redisConfig, { RedisConfig } from '../../config/redis.config';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  imports: [ConfigModule.forFeature(redisConfig)],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<RedisConfig>): Redis => {
        const config = configService.get<RedisConfig>('redis', { infer: true });
        const logger = new Logger('Redis');
        const url = config?.url ?? 'redis://localhost:6379/0';

        const client: Redis = url.startsWith('mock://')
          ? (new (require('ioredis-mock'))() as Redis)
          : new RedisClient(url, {
              keyPrefix: config?.keyPrefix,
              lazyConnect: true
            });

        client.on('error', (error) => {
          logger.error(`Redis error: ${(error as Error).message}`);
        });

        if ('connect' in client && typeof (client as RedisClient).connect === 'function') {
          void (client as RedisClient).connect().catch((error) => {
            logger.error(`Redis connection failure: ${(error as Error).message}`);
          });
        }

        return client;
      }
    }
  ],
  exports: [REDIS_CLIENT]
})
export class RedisModule implements OnModuleDestroy {
  private readonly logger = new Logger(RedisModule.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async onModuleDestroy(): Promise<void> {
    if (typeof this.redisClient?.quit === 'function') {
      try {
        await this.redisClient.quit();
      } catch (error) {
        this.logger.warn(`Failed to gracefully close Redis connection: ${(error as Error).message}`);
      }
    }
  }
}
