import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { TasksModule } from './tasks/tasks.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('tasks.database.url'),
        autoLoadEntities: true,
        synchronize: false,
        logging: configService.get<boolean>('tasks.database.logging'),
        migrationsRun: false,
        retryAttempts: 5,
        retryDelay: 2000
      })
    }),
    TasksModule,
    HealthModule
  ]
})
export class AppModule {}
