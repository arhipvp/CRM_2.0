import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';

import { DocumentsConfiguration } from '../config/configuration';
import { FoldersService } from '../folders/folders.service';
import { FolderOwnerType } from '../folders/folder.entity';
import { SyncPermissionsDto } from './dto/sync-permissions.dto';
import { PermissionsSyncTaskEntity } from './permissions-sync-task.entity';
import { PermissionsService } from './permissions.service';
import { PERMISSIONS_SYNC_JOB } from './permissions.constants';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let queue: jest.Mocked<Queue>;
  let repository: jest.Mocked<Repository<PermissionsSyncTaskEntity>>;
  let foldersService: jest.Mocked<FoldersService>;
  let configService: jest.Mocked<ConfigService<DocumentsConfiguration, true>>;

  beforeEach(() => {
    queue = {
      add: jest.fn(),
    } as unknown as jest.Mocked<Queue>;

    repository = {
      create: jest
        .fn((entity: Partial<PermissionsSyncTaskEntity>) =>
          ({ id: 'task-1', ...entity } as PermissionsSyncTaskEntity),
        )
        .mockName('create'),
      save: jest
        .fn(async (entity: PermissionsSyncTaskEntity) => entity)
        .mockName('save'),
    } as unknown as jest.Mocked<Repository<PermissionsSyncTaskEntity>>;

    foldersService = {
      findByOwner: jest.fn(),
    } as unknown as jest.Mocked<FoldersService>;

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'queues.permissionsSync.jobTtlSeconds') {
          return 300;
        }
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService<DocumentsConfiguration, true>>;

    queue.add.mockResolvedValue({ id: 'job-1' } as any);

    service = new PermissionsService(queue, repository, foldersService, configService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('ставит задачу синхронизации в очередь и сохраняет запись', async () => {
    const dto: SyncPermissionsDto = {
      ownerType: FolderOwnerType.Client,
      ownerId: '5b68c2ab-4a5f-4d6b-8e76-1234567890ab',
      users: ['user-1', 'user-2'],
    } as SyncPermissionsDto;

    foldersService.findByOwner.mockResolvedValue({ folder_id: 'drive-folder', web_link: '' });

    const result = await service.enqueueSync(dto);

    expect(queue.add).toHaveBeenCalledWith(
      PERMISSIONS_SYNC_JOB,
      {
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        folderId: 'drive-folder',
        users: dto.users,
        ttlSeconds: 300,
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        driveFolderId: 'drive-folder',
        jobId: 'job-1',
        users: dto.users,
      }),
    );

    expect(result).toEqual({ job_id: 'job-1', task_id: 'task-1' });
  });

  it('прокидывает ошибку folder_not_found, если папка отсутствует', async () => {
    const dto: SyncPermissionsDto = {
      ownerType: FolderOwnerType.Client,
      ownerId: '5b68c2ab-4a5f-4d6b-8e76-1234567890ab',
      users: ['user-1'],
    } as SyncPermissionsDto;

    foldersService.findByOwner.mockRejectedValue(
      new NotFoundException({
        statusCode: 404,
        code: 'folder_not_found',
        message: 'Папка не найдена',
      }),
    );

    await expect(service.enqueueSync(dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(queue.add).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
});
