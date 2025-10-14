import { Repository } from 'typeorm';

import { DocumentStatus } from './document-status.enum';
import { DocumentEntity } from './document.entity';
import { DocumentsService } from './documents.service';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import {
  DocumentNotFoundException,
  DocumentUploadConflictException,
} from './documents.exceptions';
import { StorageService } from '../storage/storage.service';
import { UploadUrlService } from './upload-url.service';

describe('DocumentsService.completeUpload', () => {
  let repository: jest.Mocked<Repository<DocumentEntity>>;
  let service: DocumentsService;
  let uploadUrlService: jest.Mocked<UploadUrlService>;
  let storageService: jest.Mocked<StorageService>;

  const createRepositoryMock = (): jest.Mocked<Repository<DocumentEntity>> => ({
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  }) as unknown as jest.Mocked<Repository<DocumentEntity>>;

  beforeEach(() => {
    repository = createRepositoryMock();
    uploadUrlService = { createUploadUrl: jest.fn() } as unknown as jest.Mocked<UploadUrlService>;
    storageService = { revokeDocument: jest.fn() } as unknown as jest.Mocked<StorageService>;
    service = new DocumentsService(repository, uploadUrlService, storageService);
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

  it('выбрасывает DocumentNotFoundException, если документ не найден', async () => {
    repository.findOne.mockResolvedValue(null);

    const promise = service.completeUpload('missing-id', { fileSize: 10, checksum: 'a'.repeat(32) });

    await expect(promise).rejects.toBeInstanceOf(DocumentNotFoundException);
    const error = (await promise.catch((err) => err)) as DocumentNotFoundException;
    expect(error.getResponse()).toMatchObject({ code: 'document_not_found' });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('выбрасывает DocumentUploadConflictException с кодом upload_conflict, если документ уже загружен', async () => {
    const document: DocumentEntity = {
      id: 'doc-2',
      name: 'Another doc',
      status: DocumentStatus.Synced,
      metadata: {},
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    } as DocumentEntity;

    repository.findOne.mockResolvedValue(document);

    const promise = service.completeUpload(document.id, { fileSize: 10, checksum: 'a'.repeat(32) });

    await expect(promise).rejects.toBeInstanceOf(DocumentUploadConflictException);
    const error = (await promise.catch((err) => err)) as DocumentUploadConflictException;
    expect(error.getResponse()).toMatchObject({
      code: 'upload_conflict',
      details: { status: DocumentStatus.Synced },
    });
    expect(repository.save).not.toHaveBeenCalled();
  });
});
