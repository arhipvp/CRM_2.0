import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from 'bullmq';

import { FoldersModule } from '../folders/folders.module';
import { DocumentsConfiguration } from '../config/configuration';
import { PermissionsController } from './permissions.controller';
import { PermissionsSyncTaskEntity } from './permissions-sync-task.entity';
import { PermissionsService } from './permissions.service';
import {
  PERMISSIONS_SYNC_QUEUE,
  PERMISSIONS_SYNC_QUEUE_NAME,
} from './permissions.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([PermissionsSyncTaskEntity]),
    BullModule.registerQueueAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<DocumentsConfiguration, true>) => ({
        name: config.get('queues.permissionsSync.name', { infer: true }),
      }),
    }),
    FoldersModule,
  ],
  controllers: [PermissionsController],
  providers: [
    PermissionsService,
    {
      provide: PERMISSIONS_SYNC_QUEUE_NAME,
      inject: [ConfigService],
      useFactory: (config: ConfigService<DocumentsConfiguration, true>) =>
        config.get('queues.permissionsSync.name', { infer: true }),
    },
    {
      provide: PERMISSIONS_SYNC_QUEUE,
      inject: [ModuleRef, PERMISSIONS_SYNC_QUEUE_NAME],
      useFactory: (moduleRef: ModuleRef, queueName: string) =>
        moduleRef.get<Queue>(getQueueToken(queueName), { strict: false }),
    },
  ],
})
export class PermissionsModule {}
