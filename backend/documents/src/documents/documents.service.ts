import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';

import { DocumentEntity } from './document.entity';
import { DocumentStatus } from './document-status.enum';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DriveService } from '../drive/drive.service';
import { CompleteUploadDto } from './dto/complete-upload.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly repository: Repository<DocumentEntity>,
    private readonly driveService: DriveService,
  ) {}

  async create(dto: CreateDocumentDto): Promise<DocumentEntity> {
    const entity = this.repository.create({
      name: dto.name,
      description: dto.description,
      mimeType: dto.mimeType,
      size: dto.size,
      checksumMd5: dto.checksumMd5,
      sourceUri: dto.sourceUri,
      metadata: dto.metadata,
      status: dto.status ?? DocumentStatus.PendingUpload,
    });

    return this.repository.save(entity);
  }

  async findAll(query: ListDocumentsDto): Promise<{ items: DocumentEntity[]; total: number }> {
    const where: FindOptionsWhere<DocumentEntity> = { deletedAt: IsNull() };
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: query.offset ?? 0,
      take: query.limit ?? 25,
    });
    return { items, total };
  }

  async findOne(id: string): Promise<DocumentEntity> {
    const entity = await this.repository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!entity) {
      throw new NotFoundException(`Документ ${id} не найден`);
    }
    return entity;
  }

  async update(id: string, dto: UpdateDocumentDto): Promise<DocumentEntity> {
    const entity = await this.findOne(id);
    Object.assign(entity, {
      name: dto.name ?? entity.name,
      description: dto.description ?? entity.description,
      mimeType: dto.mimeType ?? entity.mimeType,
      size: dto.size ?? entity.size,
      checksumMd5: dto.checksumMd5 ?? entity.checksumMd5,
      sourceUri: dto.sourceUri ?? entity.sourceUri,
      metadata: dto.metadata ?? entity.metadata,
      status: dto.status ?? entity.status,
    });

    return this.repository.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    if (entity.driveFileId) {
      await this.driveService.revokeDocument(entity);
    }

    Object.assign(entity, {
      deletedAt: new Date(),
      driveFileId: null,
      driveRevisionId: null,
      status: DocumentStatus.Draft,
      syncedAt: null,
      uploadedAt: null,
    });

    await this.repository.save(entity);
  }

  async markUploading(id: string): Promise<void> {
    await this.repository.update(this.withoutDeleted(id), {
      status: DocumentStatus.Uploading,
      lastError: null,
    });
  }

  async markSynced(id: string, payload: Partial<DocumentEntity>): Promise<DocumentEntity> {
    await this.repository.update(
      this.withoutDeleted(id),
      {
        ...payload,
        status: DocumentStatus.Synced,
        lastError: null,
        syncedAt: payload.syncedAt ?? new Date(),
        uploadedAt: payload.uploadedAt ?? new Date(),
      },
    );
    return this.findOne(id);
  }

  async completeUpload(id: string, dto: CompleteUploadDto): Promise<DocumentEntity> {
    const entity = await this.findOne(id);

    if (![DocumentStatus.PendingUpload, DocumentStatus.Uploading].includes(entity.status)) {
      throw new ConflictException(`Документ ${id} уже находится в статусе ${entity.status}`);
    }

    Object.assign(entity, {
      size: dto.fileSize.toString(),
      checksumMd5: dto.checksum,
      status: DocumentStatus.Uploaded,
      uploadedAt: new Date(),
      lastError: null,
      metadata: {
        ...(entity.metadata ?? {}),
        upload: {
          ...(entity.metadata?.upload ?? {}),
          fileSize: dto.fileSize,
          checksum: dto.checksum,
        },
      },
    });

    return this.repository.save(entity);
  }

  async markFailed(id: string, error: Error | string): Promise<void> {
    const lastError = typeof error === 'string' ? error : error.message;
    await this.repository.update(this.withoutDeleted(id), { status: DocumentStatus.Error, lastError });
  }

  private withoutDeleted(id: string): FindOptionsWhere<DocumentEntity> {
    return { id, deletedAt: IsNull() };
  }
}
