import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DriveModule } from '../drive/drive.module';
import { DocumentEntity } from './document.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsProcessor } from './documents.processor';
import { DocumentsQueueService } from './documents-queue.service';
import { DocumentsService } from './documents.service';
import { DOCUMENTS_QUEUE, DEFAULT_DOCUMENTS_QUEUE } from './documents.constants';
import { UploadUrlService } from './upload-url.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    BullModule.registerQueue({
      name: DOCUMENTS_QUEUE || DEFAULT_DOCUMENTS_QUEUE,
    }),
    DriveModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsQueueService, DocumentsProcessor, UploadUrlService],
  exports: [DocumentsService, DocumentsQueueService],
})
export class DocumentsModule {}
