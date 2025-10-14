import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';

import { DocumentEntity } from './document.entity';
import { DocumentStatus } from './document-status.enum';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { StorageService } from '../storage/storage.service';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import {
  DocumentAlreadyDeletedException,
  DocumentNotFoundException,
  DocumentUploadConflictException,
} from './documents.exceptions';
import { UploadUrlService } from './upload-url.service';

export interface CreateDocumentResult {
  document: DocumentEntity;
  uploadUrl: string;
  expiresIn: number;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly repository: Repository<DocumentEntity>,
    private readonly uploadUrlService: UploadUrlService,
    private readonly storageService: StorageService,
  ) {}

  async create(dto: CreateDocumentDto): Promise<CreateDocumentResult> {
    const metadata: Record<string, any> = {
      ownerType: dto.ownerType,
      ownerId: dto.ownerId,
    };

    if (dto.documentType) {
      metadata.documentType = dto.documentType;
    }

    if (dto.notes) {
      metadata.notes = dto.notes;
    }

    if (dto.tags?.length) {
      metadata.tags = dto.tags;
    }

    const entity = this.repository.create({
      name: dto.title,
      description: dto.notes ?? null,
      metadata,
      status: DocumentStatus.PendingUpload,
    });

    const document = await this.repository.save(entity);
    const { url, expiresIn } = this.uploadUrlService.createUploadUrl(document.id);

    return {
      document,
      uploadUrl: url,
      expiresIn,
    };
  }

  async findAll(query: ListDocumentsDto): Promise<[DocumentEntity[], number]> {
    const qb = this.repository.createQueryBuilder('document');
    qb.where('document.deletedAt IS NULL');

    if (query.status) {
      qb.andWhere('document.status = :status', { status: query.status });
    }

    if (query.ownerId) {
      qb.andWhere("(document.metadata ->> 'ownerId') = :ownerId", { ownerId: query.ownerId });
    }

    if (query.ownerType) {
      qb.andWhere("(document.metadata ->> 'ownerType') = :ownerType", { ownerType: query.ownerType });
    }

    if (query.documentType?.length) {
      qb.andWhere("(document.metadata ->> 'documentType') IN (:...documentTypes)", {
        documentTypes: query.documentType,
      });
    }

    if (query.search) {
      qb.andWhere(
        `(
          document.name ILIKE :search
          OR document.description ILIKE :search
          OR COALESCE(document.metadata->>'notes', '') ILIKE :search
        )`,
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('document.createdAt', 'DESC');
    qb.skip(query.offset ?? 0);
    qb.take(query.limit ?? 25);

    return qb.getManyAndCount();
  }

  async findOne(id: string): Promise<DocumentEntity> {
    const entity = await this.repository.findOne({ where: { id } });

    if (!entity) {
      throw new DocumentNotFoundException(id);
    }

    if (entity.deletedAt) {
      throw new DocumentAlreadyDeletedException(id);
    }

    return entity;
  }

  async update(id: string, dto: UpdateDocumentDto): Promise<DocumentEntity> {
    const entity = await this.findOne(id);
    if (dto.title !== undefined) {
      entity.name = dto.title;
    }

    if (dto.notes !== undefined) {
      entity.description = dto.notes ?? null;
    }

    const metadata = { ...(entity.metadata ?? {}) };

    if (dto.ownerType !== undefined) {
      metadata.ownerType = dto.ownerType;
    }

    if (dto.ownerId !== undefined) {
      metadata.ownerId = dto.ownerId;
    }

    if (dto.documentType !== undefined) {
      if (dto.documentType) {
        metadata.documentType = dto.documentType;
      } else {
        delete metadata.documentType;
      }
    }

    if (dto.notes !== undefined) {
      metadata.notes = dto.notes;
    }

    if (dto.tags !== undefined) {
      if (dto.tags.length) {
        metadata.tags = dto.tags;
      } else {
        delete metadata.tags;
      }
    }

    entity.metadata = metadata;

    return this.repository.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    if (entity.storagePath) {
      await this.storageService.revokeDocument(entity);
    }

    Object.assign(entity, {
      deletedAt: new Date(),
      storagePath: null,
      publicUrl: null,
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
    const updatePayload: Partial<DocumentEntity> = { ...payload };

    if (payload.size !== undefined && payload.size !== null) {
      updatePayload.size = String(payload.size);
    }

    await this.repository.update(
      this.withoutDeleted(id),
      {
        ...updatePayload,
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
      throw new DocumentUploadConflictException(id, entity.status);
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
