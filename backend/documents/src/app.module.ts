import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import configuration, { DocumentsConfiguration } from './config/configuration';
import { validationSchema } from './config/validation';
import { DocumentsModule } from './documents/documents.module';
import { FoldersModule } from './folders/folders.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<DocumentsConfiguration, true>) => ({
        type: 'postgres',
        url: config.get('database.url', { infer: true }),
        schema: config.get('database.schema', { infer: true }),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: config.get('database.runMigrations', { infer: true }),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<DocumentsConfiguration, true>) => ({
        connection: {
          url: config.get('redis.url', { infer: true }),
        },
        prefix: config.get('redis.prefix', { infer: true }),
      }),
    }),
    DocumentsModule,
    FoldersModule,
    PermissionsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
