import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import {
  DOCUMENTS_QUEUE,
  DOCUMENTS_SYNC_JOB,
  DOCUMENTS_UPLOAD_JOB,
} from './documents.constants';

@Injectable()
export class DocumentsQueueService {
  private readonly logger = new Logger(DocumentsQueueService.name);

  constructor(@InjectQueue(DOCUMENTS_QUEUE) private readonly queue: Queue) {}

  async enqueueUpload(documentId: string, metadata?: Record<string, any>): Promise<string> {
    const job = await this.queue.add(
      DOCUMENTS_UPLOAD_JOB,
      { documentId, metadata },
      { removeOnComplete: true, removeOnFail: false },
    );
    this.logger.debug(`Enqueued upload job ${job.id} for document ${documentId}`);
    return String(job.id);
  }

  async enqueueSync(documentId: string): Promise<string> {
    const job = await this.queue.add(
      DOCUMENTS_SYNC_JOB,
      { documentId },
      { removeOnComplete: true, removeOnFail: false },
    );
    this.logger.debug(`Enqueued sync job ${job.id} for document ${documentId}`);
    return String(job.id);
  }
}
