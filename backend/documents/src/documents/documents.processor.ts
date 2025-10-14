import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

import {
  DOCUMENTS_QUEUE,
  DOCUMENTS_SYNC_JOB,
  DOCUMENTS_UPLOAD_JOB,
} from './documents.constants';
import { DocumentsService } from './documents.service';
import { StorageService, StorageUploadResult } from '../storage/storage.service';

interface UploadJobPayload {
  documentId: string;
  metadata?: Record<string, any>;
}

interface SyncJobPayload {
  documentId: string;
}

@Processor(DOCUMENTS_QUEUE)
export class DocumentsProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentsProcessor.name);

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job): Promise<StorageUploadResult | void> {
    switch (job.name) {
      case DOCUMENTS_UPLOAD_JOB:
        return this.handleUpload(job as Job<UploadJobPayload>);
      case DOCUMENTS_SYNC_JOB:
        return this.handleSync(job as Job<SyncJobPayload>);
      default:
        this.logger.warn(`Неизвестный тип задания: ${job.name}`);
        return undefined;
    }
  }

  private async handleUpload(job: Job<UploadJobPayload>): Promise<StorageUploadResult> {
    const { documentId, metadata } = job.data;
    await this.documentsService.markUploading(documentId);
    const document = await this.documentsService.findOne(documentId);
    try {
      const result = await this.storageService.uploadDocument(document, metadata);
      const baseMetadata = document.metadata ?? {};
      const resultMetadata = result.metadata ?? {};
      const size = result.size != null ? String(result.size) : undefined;
      await this.documentsService.markSynced(documentId, {
        storagePath: result.path,
        publicUrl: result.publicUrl,
        size,
        checksumMd5: result.checksumMd5 ?? undefined,
        uploadedAt: result.uploadedAt,
        syncedAt: result.syncedAt,
        metadata: { ...baseMetadata, ...resultMetadata },
      });
      this.logger.log(`Документ ${documentId} синхронизирован с файловым хранилищем (${result.path})`);
      return result;
    } catch (error) {
      this.logger.error(`Не удалось загрузить документ ${documentId}`, error as Error);
      await this.documentsService.markFailed(documentId, error as Error);
      throw error;
    }
  }

  private async handleSync(job: Job<SyncJobPayload>): Promise<StorageUploadResult | void> {
    const { documentId } = job.data;
    const document = await this.documentsService.findOne(documentId);
    if (!document.storagePath) {
      this.logger.warn(`Документ ${documentId} не содержит пути в файловом хранилище`);
      return;
    }

    try {
      const result = await this.storageService.syncDocument(document);
      const baseMetadata = document.metadata ?? {};
      const resultMetadata = result.metadata ?? {};
      const size =
        result.size != null
          ? String(result.size)
          : document.size !== undefined && document.size !== null
            ? document.size
            : undefined;
      await this.documentsService.markSynced(documentId, {
        storagePath: result.path,
        publicUrl: result.publicUrl,
        uploadedAt: document.uploadedAt ?? result.uploadedAt,
        syncedAt: result.syncedAt,
        size,
        checksumMd5: result.checksumMd5 ?? document.checksumMd5 ?? undefined,
        metadata: { ...baseMetadata, ...resultMetadata },
      });
      this.logger.log(`Метаданные документа ${documentId} обновлены`);
      return result;
    } catch (error) {
      this.logger.error(`Не удалось синхронизировать документ ${documentId}`, error as Error);
      await this.documentsService.markFailed(documentId, error as Error);
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.error(`Задание ${job.name} (${job.id}) завершилось ошибкой: ${err.message}`);
  }
}
