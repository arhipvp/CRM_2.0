import { BadRequestException, INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { FoldersService } from '../folders/folders.service';
import { FolderOwnerType } from '../folders/folder.entity';
import { PermissionsController } from './permissions.controller';
import { PermissionsSyncTaskEntity } from './permissions-sync-task.entity';
import { PermissionsService } from './permissions.service';
import { PERMISSIONS_SYNC_QUEUE } from './permissions.constants';

describe('PermissionsController', () => {
  let app: INestApplication;
  let foldersService: { findByOwner: jest.Mock };
  let queue: { add: jest.Mock };
  let repository: { create: jest.Mock; save: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    foldersService = { findByOwner: jest.fn() };
    queue = { add: jest.fn() };
    repository = { create: jest.fn(), save: jest.fn() };
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'queues.permissionsSync.jobTtlSeconds') {
          return 300;
        }
        return undefined;
      }),
    };

    repository.create.mockImplementation((entity) => ({ id: 'task-77', ...entity }));
    repository.save.mockImplementation(async (entity) => entity);
    queue.add.mockResolvedValue({ id: 'job-99' });

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [
        PermissionsService,
        { provide: FoldersService, useValue: foldersService },
        { provide: PERMISSIONS_SYNC_QUEUE, useValue: queue },
        {
          provide: getRepositoryToken(PermissionsSyncTaskEntity),
          useValue: repository,
        },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        forbidUnknownValues: false,
        exceptionFactory: (errors) =>
          new BadRequestException({
            statusCode: 400,
            code: 'validation_error',
            message: 'Ошибка валидации',
            errors: errors.map((error) => ({
              field: error.property,
              constraints: error.constraints,
            })),
          }),
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.resetAllMocks();
  });

  it('POST /api/v1/permissions/sync ставит задачу и возвращает идентификатор', async () => {
    foldersService.findByOwner.mockResolvedValue({
      folder_path: 'clients/owner-id',
      full_path: '/mnt/documents/clients/owner-id',
      public_url: null,
    });

    const payload = {
      owner_type: FolderOwnerType.Client,
      owner_id: '5b68c2ab-4a5f-4d6b-8e76-1234567890ab',
      users: ['user-1', 'user-2'],
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/permissions/sync')
      .send(payload);
    expect(response.status).toBe(202);

    expect(response.body).toEqual({ job_id: 'job-99', task_id: 'task-77' });
    expect(foldersService.findByOwner).toHaveBeenCalledWith(payload.owner_type, payload.owner_id);
    expect(queue.add).toHaveBeenCalled();
  });

  it('POST /api/v1/permissions/sync возвращает validation_error при некорректных данных', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/permissions/sync')
      .send({ owner_type: 'unknown', owner_id: 'not-a-uuid', users: [] })
      .expect(400);

    expect(response.body).toMatchObject({
      code: 'validation_error',
      statusCode: 400,
    });
    expect(response.body.errors).toBeInstanceOf(Array);
  });

  it('POST /api/v1/permissions/sync возвращает folder_not_found, если папка отсутствует', async () => {
    foldersService.findByOwner.mockRejectedValue(
      new NotFoundException({
        statusCode: 404,
        code: 'folder_not_found',
        message: 'Папка не найдена',
      }),
    );

    const payload = {
      owner_type: FolderOwnerType.Client,
      owner_id: '5b68c2ab-4a5f-4d6b-8e76-1234567890ab',
      users: ['user-1'],
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/permissions/sync')
      .send(payload);
    expect(response.status).toBe(404);

    expect(response.body).toMatchObject({ code: 'folder_not_found' });
    expect(queue.add).not.toHaveBeenCalled();
  });
});
