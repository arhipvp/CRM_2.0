import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DocumentsConfiguration } from '../config/configuration';
import { StorageService } from '../storage/storage.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { FolderResponse } from './dto/folder-response.dto';
import { FolderEntity, FolderOwnerType } from './folder.entity';

@Injectable()
export class FoldersService {
  constructor(
    @InjectRepository(FolderEntity)
    private readonly repository: Repository<FolderEntity>,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService<DocumentsConfiguration, true>,
  ) {}

  async create(dto: CreateFolderDto): Promise<FolderResponse> {
    const existing = await this.repository.findOne({
      where: { ownerType: dto.ownerType, ownerId: dto.ownerId },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        code: 'folder_exists',
        message: `Папка для ${dto.ownerType}:${dto.ownerId} уже существует`,
      });
    }

    const { folderName, template } = this.buildFolderName(dto.ownerType, dto.ownerId, dto.title);
    const storageFolder = await this.storageService.createFolder(folderName, dto.parentPath);

    const publicUrl = storageFolder.publicUrl ?? this.buildWebLink(storageFolder.path);

    const metadata: Record<string, any> = {
      template,
      requestedTitle: dto.title,
    };
    if (storageFolder.metadata) {
      metadata.storage = storageFolder.metadata;
    }

    const entity = this.repository.create({
      ownerType: dto.ownerType,
      ownerId: dto.ownerId,
      name: storageFolder.metadata?.name ?? folderName,
      storagePath: storageFolder.path,
      parentPath: dto.parentPath ?? null,
      publicUrl,
      metadata,
    });

    const saved = await this.repository.save(entity);
    return this.mapToResponse(saved);
  }

  async findByOwner(ownerType: FolderOwnerType, ownerId: string): Promise<FolderResponse> {
    const folder = await this.repository.findOne({ where: { ownerType, ownerId } });
    if (!folder) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'folder_not_found',
        message: `Папка для ${ownerType}:${ownerId} не найдена`,
      });
    }
    return this.mapToResponse(folder);
  }

  private mapToResponse(folder: FolderEntity): FolderResponse {
    const publicUrl = folder.publicUrl ?? this.storageService.getPublicUrl(folder.storagePath) ?? this.buildWebLink(folder.storagePath);
    return {
      folder_path: folder.storagePath,
      full_path: this.storageService.getAbsolutePath(folder.storagePath),
      public_url: publicUrl,
    };
  }

  private buildFolderName(ownerType: FolderOwnerType, ownerId: string, title: string) {
    const templates = this.configService.get('folders.templates', { infer: true });
    const template = templates?.[ownerType] ?? templates?.default ?? '{title}';
    const replacements: Record<string, string> = {
      '{title}': title,
      '{ownerId}': ownerId,
      '{ownerType}': ownerType,
    };

    const folderName = Object.entries(replacements).reduce(
      (acc, [token, value]) => acc.split(token).join(value),
      template,
    );

    return { folderName, template };
  }

  private buildWebLink(folderPath: string): string {
    const base =
      this.configService.get('folders.webBaseUrl', { infer: true }) ?? 'https://files.local/documents/';
    const normalized = base.endsWith('/') ? base : `${base}/`;
    const normalizedPath = folderPath.replace(/\\/g, '/');
    return `${normalized}${normalizedPath}`;
  }
}
