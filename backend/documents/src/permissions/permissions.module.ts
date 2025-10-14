import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FoldersModule } from '../folders/folders.module';
import { PermissionsController } from './permissions.controller';
import { PermissionsSyncTaskEntity } from './permissions-sync-task.entity';
import { PermissionsService } from './permissions.service';
import { PERMISSIONS_SYNC_QUEUE } from './permissions.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([PermissionsSyncTaskEntity]),
    BullModule.registerQueue({
      name: PERMISSIONS_SYNC_QUEUE,
    }),
    FoldersModule,
  ],
  controllers: [PermissionsController],
  providers: [PermissionsService],
})
export class PermissionsModule {}
