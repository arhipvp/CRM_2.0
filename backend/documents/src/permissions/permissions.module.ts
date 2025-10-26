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
import { PERMISSIONS_SYNC_QUEUE } from './permissions.constants';

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
      provide: getQueueToken(PERMISSIONS_SYNC_QUEUE),
      inject: [ConfigService, ModuleRef],
      useFactory: (
        config: ConfigService<DocumentsConfiguration, true>,
        moduleRef: ModuleRef,
      ) => {
        const queueName = config.get('queues.permissionsSync.name', { infer: true });
        return moduleRef.get<Queue>(getQueueToken(queueName), { strict: false });
      },
    },
  ],
})
export class PermissionsModule {}
