import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { DriveService } from '../drive/drive.service';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { DocumentStatus } from './document-status.enum';
import { DocumentEntity } from './document.entity';
import { DocumentsService } from './documents.service';

const createRepositoryMock = (): jest.Mocked<Repository<DocumentEntity>> =>
  ({
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<Repository<DocumentEntity>>);

const createDriveServiceMock = (): jest.Mocked<DriveService> =>
  ({
    revokeDocument: jest.fn(),
  } as unknown as jest.Mocked<DriveService>);

describe('DocumentsService', () => {
  let service: DocumentsService;
  let repository: jest.Mocked<Repository<DocumentEntity>>;
  let driveService: jest.Mocked<DriveService>;

  beforeEach(() => {
    repository = createRepositoryMock();
    driveService = createDriveServiceMock();
    service = new DocumentsService(repository, driveService);
  });

  it('исключает удалённые документы из поиска', async () => {
    repository.findAndCount.mockResolvedValue([[], 0]);

    await service.findAll({});

    const args = repository.findAndCount.mock.calls[0][0] as Record<string, any>;
    expect(args.where.deletedAt).toMatchObject({ _type: 'isNull' });
  });

  it('помечает документ удалённым и отзывает файл', async () => {
    const document: DocumentEntity = {
      id: 'doc-1',
      name: 'Test',
      status: DocumentStatus.Synced,
      createdAt: new Date(),
      updatedAt: new Date(),
      driveFileId: 'drive-1',
      driveRevisionId: 'rev-1',
    } as DocumentEntity;
    repository.findOne.mockResolvedValue(document);

    await service.remove(document.id);

    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: document.id } });
    expect(driveService.revokeDocument).toHaveBeenCalledWith(document);
    expect(repository.save).toHaveBeenCalled();
    const saved = repository.save.mock.calls[0][0];
    expect(saved.deletedAt).toBeInstanceOf(Date);
    expect(saved.driveFileId).toBeNull();
    expect(saved.driveRevisionId).toBeNull();
    expect(saved.status).toBe(DocumentStatus.Draft);
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it('бросает исключение, если документ не найден', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('бросает ConflictException с кодом already_deleted, если документ уже удалён', async () => {
    const deletedAt = new Date('2024-01-02T00:00:00Z');
    const document: DocumentEntity = {
      id: 'doc-deleted',
      name: 'Удалённый документ',
      status: DocumentStatus.Draft,
      deletedAt,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    } as DocumentEntity;
    repository.findOne.mockResolvedValue(document);

    const promise = service.remove(document.id);

    await expect(promise).rejects.toBeInstanceOf(ConflictException);

    const error = (await promise.catch((err) => err)) as ConflictException;
    expect(error.getResponse()).toMatchObject({ code: 'already_deleted' });
    expect(driveService.revokeDocument).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
});

describe('DocumentsService.completeUpload', () => {
  let repository: jest.Mocked<Repository<DocumentEntity>>;
  let service: DocumentsService;
  let driveService: jest.Mocked<DriveService>;

  beforeEach(() => {
    repository = createRepositoryMock();
    driveService = createDriveServiceMock();
    service = new DocumentsService(repository, driveService);
  });

  it('переводит документ в статус uploaded и сохраняет атрибуты файла', async () => {
    const document: DocumentEntity = {
      id: 'doc-1',
      name: 'Test document',
      status: DocumentStatus.PendingUpload,
      metadata: { foo: 'bar' },
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    } as DocumentEntity;

    const dto: CompleteUploadDto = { fileSize: 1024, checksum: 'abcdef1234567890' };

    repository.findOne.mockResolvedValue(document);
    repository.save.mockImplementation(async (entity) => entity as DocumentEntity);

    const result = await service.completeUpload(document.id, dto);

    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ id: document.id }));
    expect(result.status).toBe(DocumentStatus.Uploaded);
    expect(result.size).toBe(String(dto.fileSize));
    expect(result.checksumMd5).toBe(dto.checksum);
    expect(result.uploadedAt).toBeInstanceOf(Date);
    expect(result.lastError).toBeNull();
    expect(result.metadata).toMatchObject({
      foo: 'bar',
      upload: { fileSize: dto.fileSize, checksum: dto.checksum },
    });
  });

  it('выбрасывает NotFoundException, если документ не найден', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.completeUpload('missing-id', { fileSize: 10, checksum: 'a'.repeat(32) }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('выбрасывает ConflictException, если документ уже загружен', async () => {
    const document: DocumentEntity = {
      id: 'doc-2',
      name: 'Another doc',
      status: DocumentStatus.Synced,
      metadata: {},
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    } as DocumentEntity;

    repository.findOne.mockResolvedValue(document);

    await expect(service.completeUpload(document.id, { fileSize: 10, checksum: 'a'.repeat(32) }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
