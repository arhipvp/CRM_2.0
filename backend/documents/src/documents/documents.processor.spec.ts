import { Job } from 'bullmq';

import { DocumentsProcessor } from './documents.processor';
import { DocumentsService } from './documents.service';
import { StorageService, StorageUploadResult } from '../storage/storage.service';
import { DOCUMENTS_UPLOAD_JOB } from './documents.constants';
import { DocumentEntity } from './document.entity';
import { DocumentStatus } from './document-status.enum';

describe('DocumentsProcessor', () => {
  let documentsService: jest.Mocked<DocumentsService>;
  let storageService: jest.Mocked<StorageService>;
  let processor: DocumentsProcessor;

  beforeEach(() => {
    documentsService = {
      markUploading: jest.fn(),
      findOne: jest.fn(),
      markSynced: jest.fn(),
      markFailed: jest.fn(),
    } as unknown as jest.Mocked<DocumentsService>;

    storageService = {
      uploadDocument: jest.fn(),
      syncDocument: jest.fn(),
    } as unknown as jest.Mocked<StorageService>;

    processor = new DocumentsProcessor(documentsService, storageService);
  });

  it('сохраняет пустой объект метаданных, если документ содержит null и хранилище не вернуло данные', async () => {
    const document: DocumentEntity = {
      id: 'doc-1',
      name: 'Test document',
      status: DocumentStatus.PendingUpload,
      metadata: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    } as DocumentEntity;

    const storageResult: StorageUploadResult = {
      path: 'client/owner/doc-1.pdf',
      publicUrl: null,
      uploadedAt: new Date('2024-01-01T00:00:01Z'),
      syncedAt: new Date('2024-01-01T00:00:02Z'),
      metadata: undefined,
    };

    documentsService.markUploading.mockResolvedValue(undefined);
    documentsService.findOne.mockResolvedValue(document);
    documentsService.markSynced.mockResolvedValue({ ...document, metadata: {} });
    storageService.uploadDocument.mockResolvedValue(storageResult);

    const job = {
      name: DOCUMENTS_UPLOAD_JOB,
      data: { documentId: document.id },
    } as unknown as Job;

    const result = await processor.process(job);

    expect(result).toEqual(storageResult);
    expect(storageService.uploadDocument).toHaveBeenCalledWith(document, undefined);
    expect(documentsService.markSynced).toHaveBeenCalledWith(
      document.id,
      expect.objectContaining({
        metadata: {},
        storagePath: storageResult.path,
        publicUrl: storageResult.publicUrl,
      }),
    );
    expect(documentsService.markFailed).not.toHaveBeenCalled();
  });
});
