import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DocumentsConfiguration } from '../config/configuration';
import { DriveService } from '../drive/drive.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { FolderEntity, FolderOwnerType } from './folder.entity';

interface FolderResponse {
  folder_id: string;
  web_link: string;
}

@Injectable()
export class FoldersService {
  constructor(
    @InjectRepository(FolderEntity)
    private readonly repository: Repository<FolderEntity>,
    private readonly driveService: DriveService,
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
    const driveFolder = await this.driveService.createFolder(folderName, dto.parentFolderId);

    const webLink = driveFolder.webViewLink ?? this.buildWebLink(driveFolder.id);

    const metadata: Record<string, any> = {
      template,
      requestedTitle: dto.title,
    };
    if (driveFolder.metadata) {
      metadata.drive = driveFolder.metadata;
    }

    const entity = this.repository.create({
      ownerType: dto.ownerType,
      ownerId: dto.ownerId,
      name: driveFolder.name ?? folderName,
      driveFolderId: driveFolder.id,
      parentFolderId: dto.parentFolderId ?? null,
      webLink,
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
    return {
      folder_id: folder.driveFolderId,
      web_link: folder.webLink ?? this.buildWebLink(folder.driveFolderId),
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

  private buildWebLink(folderId: string): string {
    const base = this.configService.get('folders.webBaseUrl', { infer: true }) ??
      'https://drive.google.com/drive/folders/';
    const normalized = base.endsWith('/') ? base : `${base}/`;
    return `${normalized}${folderId}`;
  }
}
