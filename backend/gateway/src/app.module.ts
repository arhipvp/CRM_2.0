import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';

import { HealthModule } from './http/health/health.module';
import { HttpConfigModule } from './config/http-config.module';
import { SseModule } from './sse/sse.module';
import upstreamsConfig from './config/upstreams.config';
import redisConfig, { RedisConfig } from './config/redis.config';
import consulConfig from './config/consul.config';
import { RedisModule } from './integrations/redis/redis.module';
import { ConsulModule } from './integrations/consul/consul.module';
import { CrmModule } from './http/crm/crm.module';
import { PaymentsModule } from './http/payments/payments.module';
import { AuthModule } from './http/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : undefined,
      load: [upstreamsConfig, redisConfig, consulConfig]
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService<RedisConfig>) => {
        const config = configService.get<RedisConfig>('redis', { infer: true });
        const urlValue = config?.url ?? 'redis://localhost:6379/0';

        if (urlValue.startsWith('mock://')) {
          return {
            ttl: config?.cacheTtl
          };
        }

        const parsed = new URL(urlValue);
        const db = Number.parseInt(parsed.pathname.replace('/', ''), 10);

        return {
          store: await redisStore({
            host: parsed.hostname,
            port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
            username: parsed.username || undefined,
            password: parsed.password || undefined,
            db: Number.isNaN(db) ? undefined : db,
            ttl: config?.cacheTtl,
            keyPrefix: config?.keyPrefix
          }),
          ttl: config?.cacheTtl
        };
      }
    }),
    RedisModule,
    ConsulModule,
    HttpConfigModule,
    CrmModule,
    PaymentsModule,
    AuthModule,
    HealthModule,
    SseModule
  ]
})
export class AppModule {}
