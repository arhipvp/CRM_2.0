import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';

import { DocumentsConfiguration } from '../config/configuration';
import { FoldersService } from '../folders/folders.service';
import { SyncPermissionsDto } from './dto/sync-permissions.dto';
import { SyncPermissionsResponse } from './dto/sync-permissions-response.dto';
import { PermissionsSyncTaskEntity } from './permissions-sync-task.entity';
import { PERMISSIONS_SYNC_JOB, PERMISSIONS_SYNC_QUEUE } from './permissions.constants';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    @Inject(PERMISSIONS_SYNC_QUEUE)
    private readonly queue: Queue,
    @InjectRepository(PermissionsSyncTaskEntity)
    private readonly repository: Repository<PermissionsSyncTaskEntity>,
    private readonly foldersService: FoldersService,
    private readonly configService: ConfigService<DocumentsConfiguration, true>,
  ) {}

  async enqueueSync(dto: SyncPermissionsDto): Promise<SyncPermissionsResponse> {
    const folder = await this.foldersService.findByOwner(dto.ownerType, dto.ownerId);

    const ttlSeconds = this.configService.get('queues.permissionsSync.jobTtlSeconds', {
      infer: true,
    });
    const hasTtl = typeof ttlSeconds === 'number' && ttlSeconds > 0;

    const jobPayload: Record<string, any> = {
      ownerType: dto.ownerType,
      ownerId: dto.ownerId,
      folderPath: folder.folder_path,
      users: dto.users,
    };

    if (hasTtl) {
      jobPayload.ttlSeconds = ttlSeconds;
    }

    const job = await this.queue.add(
      PERMISSIONS_SYNC_JOB,
      jobPayload,
      {
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    const entity = this.repository.create({
      ownerType: dto.ownerType,
      ownerId: dto.ownerId,
      folderPath: folder.folder_path,
      jobId: String(job.id),
      users: dto.users,
    });
    const saved = await this.repository.save(entity);

    this.logger.debug(
      `Enqueued permissions sync job ${job.id} for ${dto.ownerType}:${dto.ownerId}`,
    );

    return {
      job_id: String(job.id),
      task_id: saved.id,
    };
  }
}
