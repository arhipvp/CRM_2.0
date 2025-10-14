import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';

import { DocumentsConfiguration } from '../config/configuration';
import { StorageService, StorageDirectory } from '../storage/storage.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { FolderEntity, FolderOwnerType } from './folder.entity';
import { FoldersService } from './folders.service';

describe('FoldersService', () => {
  let service: FoldersService;
  let repository: jest.Mocked<Repository<FolderEntity>>;
  let storageService: jest.Mocked<StorageService>;
  let configService: jest.Mocked<ConfigService<DocumentsConfiguration, true>>;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<FolderEntity>>;

    storageService = {
      createFolder: jest.fn(),
      getAbsolutePath: jest.fn(),
      getPublicUrl: jest.fn(),
    } as unknown as jest.Mocked<StorageService>;

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
          return 'https://files.example/documents/';
        }
        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as jest.Mocked<ConfigService<DocumentsConfiguration, true>>;

    repository.create = jest.fn((entity) => entity as FolderEntity) as any;
    repository.save = jest.fn(async (entity) => ({ ...entity, id: 'uuid' })) as any;

    storageService.getAbsolutePath.mockImplementation((path) => `/mnt/documents/${path}`);
    storageService.getPublicUrl.mockImplementation((path) => `https://files.example/documents/${path}`);

    service = new FoldersService(repository, storageService, configService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('создаёт новую папку в файловом хранилище и сохраняет запись', async () => {
    repository.findOne.mockResolvedValue(null);

    const storageFolder: StorageDirectory = {
      path: 'clients/11111111-1111-1111-1111-111111111111',
      fullPath: '/mnt/documents/clients/11111111-1111-1111-1111-111111111111',
      publicUrl: null,
      metadata: { name: 'Client 123' },
    };

    storageService.createFolder.mockResolvedValue(storageFolder);

    const dto: CreateFolderDto = {
      ownerType: FolderOwnerType.Client,
      ownerId: '11111111-1111-1111-1111-111111111111',
      title: 'Основные документы',
    } as CreateFolderDto;

    const result = await service.create(dto);

    expect(storageService.createFolder).toHaveBeenCalledWith('Client 11111111-1111-1111-1111-111111111111', undefined);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: FolderOwnerType.Client,
        storagePath: storageFolder.path,
        publicUrl: 'https://files.example/documents/clients/11111111-1111-1111-1111-111111111111',
        metadata: expect.objectContaining({ template: 'Client {ownerId}', requestedTitle: dto.title }),
      }),
    );
    expect(result).toEqual({
      folder_path: storageFolder.path,
      full_path: '/mnt/documents/clients/11111111-1111-1111-1111-111111111111',
      public_url: 'https://files.example/documents/clients/11111111-1111-1111-1111-111111111111',
    });
  });

  it('не создаёт дубликаты папок', async () => {
    repository.findOne.mockResolvedValue({
      storagePath: 'clients/11111111-1111-1111-1111-111111111111',
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
      storagePath: 'clients/11111111-1111-1111-1111-111111111111',
      publicUrl: 'https://files.example/documents/clients/11111111-1111-1111-1111-111111111111',
    } as FolderEntity);

    await expect(service.findByOwner(FolderOwnerType.Client, '11111111-1111-1111-1111-111111111111')).resolves.toEqual({
      folder_path: 'clients/11111111-1111-1111-1111-111111111111',
      full_path: '/mnt/documents/clients/11111111-1111-1111-1111-111111111111',
      public_url: 'https://files.example/documents/clients/11111111-1111-1111-1111-111111111111',
    });
  });

  it('сообщает об ошибке, если папка не найдена', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.findByOwner(FolderOwnerType.Client, '11111111-1111-1111-1111-111111111111'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
