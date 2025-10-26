import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from 'bullmq';

import { StorageModule } from '../storage/storage.module';
import { DocumentsConfiguration } from '../config/configuration';
import { DocumentEntity } from './document.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsProcessor } from './documents.processor';
import { DocumentsQueueService } from './documents-queue.service';
import { DocumentsService } from './documents.service';
import { DOCUMENTS_QUEUE } from './documents.constants';
import { UploadUrlService } from './upload-url.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    BullModule.registerQueueAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<DocumentsConfiguration, true>) => ({
        name: config.get('queues.documents', { infer: true }),
      }),
    }),
    StorageModule,
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentsQueueService,
    DocumentsProcessor,
    UploadUrlService,
    {
      provide: getQueueToken(DOCUMENTS_QUEUE),
      inject: [ConfigService, ModuleRef],
      useFactory: (
        config: ConfigService<DocumentsConfiguration, true>,
        moduleRef: ModuleRef,
      ) => {
        const queueName = config.get('queues.documents', { infer: true });
        return moduleRef.get<Queue>(getQueueToken(queueName), { strict: false });
      },
    },
  ],
  exports: [DocumentsService, DocumentsQueueService],
})
export class DocumentsModule {}
