import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';

import { DocumentsConfiguration } from '../config/configuration';
import { DriveService, DriveFolderMetadata } from '../drive/drive.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { FolderEntity, FolderOwnerType } from './folder.entity';
import { FoldersService } from './folders.service';

describe('FoldersService', () => {
  let service: FoldersService;
  let repository: jest.Mocked<Repository<FolderEntity>>;
  let driveService: jest.Mocked<DriveService>;
  let configService: jest.Mocked<ConfigService<DocumentsConfiguration, true>>;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<FolderEntity>>;

    driveService = {
      createFolder: jest.fn(),
    } as unknown as jest.Mocked<DriveService>;

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'folders.templates') {
          return {
            default: '{title}',
            client: 'Client {ownerId}',
            deal: 'Deal {ownerId}',
            policy: 'Policy {ownerId}',
            payment: 'Payment {ownerId}',
          };
        }
        if (key === 'folders.webBaseUrl') {
          return 'https://drive.example/folders/';
        }
        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as jest.Mocked<ConfigService<DocumentsConfiguration, true>>;

    repository.create = jest.fn((entity) => entity as FolderEntity) as any;
    repository.save = jest.fn(async (entity) => ({ ...entity, id: 'uuid' })) as any;

    service = new FoldersService(repository, driveService, configService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('создаёт новую папку в Drive и сохраняет запись', async () => {
    repository.findOne.mockResolvedValue(null);

    const driveFolder: DriveFolderMetadata = {
      id: 'drive-folder-id',
      name: 'Client 123',
      webViewLink: null,
      metadata: { webViewLink: null },
    };

    driveService.createFolder.mockResolvedValue(driveFolder);

    const dto: CreateFolderDto = {
      ownerType: FolderOwnerType.Client,
      ownerId: '11111111-1111-1111-1111-111111111111',
      title: 'Основные документы',
    } as CreateFolderDto;

    const result = await service.create(dto);

    expect(driveService.createFolder).toHaveBeenCalledWith('Client 11111111-1111-1111-1111-111111111111', undefined);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: FolderOwnerType.Client,
        driveFolderId: driveFolder.id,
        webLink: 'https://drive.example/folders/drive-folder-id',
        metadata: expect.objectContaining({ template: 'Client {ownerId}', requestedTitle: dto.title }),
      }),
    );
    expect(result).toEqual({
      folder_id: 'drive-folder-id',
      web_link: 'https://drive.example/folders/drive-folder-id',
    });
  });

  it('не создаёт дубликаты папок', async () => {
    repository.findOne.mockResolvedValue({
      driveFolderId: 'drive-folder-id',
    } as FolderEntity);

    await expect(
      service.create({
        ownerType: FolderOwnerType.Client,
        ownerId: '11111111-1111-1111-1111-111111111111',
        title: 'Дубликат',
      } as CreateFolderDto),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('возвращает папку по владельцу', async () => {
    repository.findOne.mockResolvedValue({
      driveFolderId: 'drive-folder-id',
      webLink: 'https://drive.example/folders/drive-folder-id',
    } as FolderEntity);

    await expect(service.findByOwner(FolderOwnerType.Client, '11111111-1111-1111-1111-111111111111')).resolves.toEqual({
      folder_id: 'drive-folder-id',
      web_link: 'https://drive.example/folders/drive-folder-id',
    });
  });

  it('сообщает об ошибке, если папка не найдена', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.findByOwner(FolderOwnerType.Client, '11111111-1111-1111-1111-111111111111'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
