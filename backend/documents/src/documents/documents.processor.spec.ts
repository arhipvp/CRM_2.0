import { Job } from 'bullmq';

import { DocumentsProcessor } from './documents.processor';
import { DocumentsService } from './documents.service';
import { DriveService, DriveUploadResult } from '../drive/drive.service';
import { DOCUMENTS_UPLOAD_JOB } from './documents.constants';
import { DocumentEntity } from './document.entity';
import { DocumentStatus } from './document-status.enum';

describe('DocumentsProcessor', () => {
  let documentsService: jest.Mocked<DocumentsService>;
  let driveService: jest.Mocked<DriveService>;
  let processor: DocumentsProcessor;

  beforeEach(() => {
    documentsService = {
      markUploading: jest.fn(),
      findOne: jest.fn(),
      markSynced: jest.fn(),
      markFailed: jest.fn(),
    } as unknown as jest.Mocked<DocumentsService>;

    driveService = {
      uploadDocument: jest.fn(),
      syncDocument: jest.fn(),
    } as unknown as jest.Mocked<DriveService>;

    processor = new DocumentsProcessor(documentsService, driveService);
  });

  it('сохраняет пустой объект метаданных, если документ содержит null и Drive не вернул данные', async () => {
    const document: DocumentEntity = {
      id: 'doc-1',
      name: 'Test document',
      status: DocumentStatus.PendingUpload,
      metadata: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    } as DocumentEntity;

    const driveResult: DriveUploadResult = {
      fileId: 'drive-file',
      revisionId: '1',
      uploadedAt: new Date('2024-01-01T00:00:01Z'),
      syncedAt: new Date('2024-01-01T00:00:02Z'),
      metadata: undefined,
    };

    documentsService.markUploading.mockResolvedValue(undefined);
    documentsService.findOne.mockResolvedValue(document);
    documentsService.markSynced.mockResolvedValue({ ...document, metadata: {} });
    driveService.uploadDocument.mockResolvedValue(driveResult);

    const job = {
      name: DOCUMENTS_UPLOAD_JOB,
      data: { documentId: document.id },
    } as unknown as Job;

    const result = await processor.process(job);

    expect(result).toEqual(driveResult);
    expect(driveService.uploadDocument).toHaveBeenCalledWith(document, undefined);
    expect(documentsService.markSynced).toHaveBeenCalledWith(
      document.id,
      expect.objectContaining({ metadata: {} }),
    );
    expect(documentsService.markFailed).not.toHaveBeenCalled();
  });
});
