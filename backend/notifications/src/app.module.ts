import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { RedisModule, RedisModuleOptions } from '@liaoliaots/nestjs-redis';
import configuration, { NotificationsConfiguration } from './config/configuration';
import { validationSchema } from './config/validation';
import { NotificationsModule } from './notifications/notifications.module';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('postgres.host', { infer: true }),
        port: configService.get<number>('postgres.port', { infer: true }),
        username: configService.get<string>('postgres.user', { infer: true }),
        password: configService.get<string>('postgres.password', { infer: true }),
        database: configService.get<string>('postgres.database', { infer: true }),
        ssl: configService.get<boolean>('postgres.ssl', { infer: true }) || false,
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false
      })
    }),
    RabbitMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (
        configService: ConfigService<NotificationsConfiguration>
      ) => {
        const uri = configService.getOrThrow<string>('rabbitmq.uri', { infer: true });
        const exchange = configService.getOrThrow<string>('rabbitmq.exchange', { infer: true });
        return {
          uri,
          exchanges: [
            {
              name: exchange,
              type: 'topic'
            }
          ],
          connectionInitOptions: { wait: true },
          enableControllerDiscovery: true
        };
      }
    }),
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (
        ...args: unknown[]
      ): Promise<RedisModuleOptions> => {
        const configService = args[0] as ConfigService<NotificationsConfiguration>;
        const host = configService.getOrThrow<string>('redis.host', { infer: true });
        const port = configService.getOrThrow<number>('redis.port', { infer: true });
        const db = configService.getOrThrow<number>('redis.db', { infer: true });
        const keyPrefix = configService.get<string>('redis.keyPrefix', { infer: true });
        const username = configService.get<string>('redis.username', { infer: true });
        const password = configService.get<string>('redis.password', { infer: true });
        return {
          config: {
            host,
            port,
            username: username || undefined,
            password: password || undefined,
            db,
            keyPrefix
          }
        };
      }
    }),
    NotificationsModule,
    TemplatesModule
  ]
})
export class AppModule {}
