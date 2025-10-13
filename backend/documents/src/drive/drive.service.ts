import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createReadStream, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

import { DocumentsConfiguration } from '../config/configuration';
import { DocumentEntity } from '../documents/document.entity';

export interface DriveUploadResult {
  fileId: string;
  revisionId?: string | null;
  uploadedAt: Date;
  syncedAt: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);
  private driveClient?: drive_v3.Drive;

  constructor(private readonly configService: ConfigService<DocumentsConfiguration, true>) {}

  async uploadDocument(
    document: DocumentEntity,
    metadata?: Record<string, any>,
  ): Promise<DriveUploadResult> {
    const driveConfig = this.configService.get('drive', { infer: true });

    if (driveConfig.emulatorUrl) {
      const baseMetadata = document.metadata ?? {};
      const uploadMetadata = metadata ?? {};
      const response = await axios.post(
        new URL('/files', driveConfig.emulatorUrl).toString(),
        {
          name: document.name,
          description: document.description,
          mimeType: document.mimeType,
          parents: driveConfig.emulatorRoot ? [driveConfig.emulatorRoot] : undefined,
          metadata: { ...baseMetadata, ...uploadMetadata },
        },
      );

      const now = new Date(response.data.modifiedTime ?? response.data.updated ?? Date.now());
      return {
        fileId: response.data.id,
        revisionId: response.data.headRevisionId ?? response.data.version,
        uploadedAt: now,
        syncedAt: now,
        metadata: response.data,
      };
    }

    const drive = await this.getDriveClient();
    if (!drive) {
      throw new Error('Google Drive client is not configured');
    }

    const fileMetadata: drive_v3.Schema$File = {
      name: document.name,
      description: document.description ?? undefined,
      mimeType: document.mimeType ?? undefined,
      parents: driveConfig.sharedDriveId ? [driveConfig.sharedDriveId] : undefined,
    };

    const media = await this.resolveMedia(document);

    const uploadMetadata = metadata ?? {};

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media ?? undefined,
      supportsAllDrives: true,
      fields: 'id, name, mimeType, size, md5Checksum, version, headRevisionId, modifiedTime',
    });

    const file = response.data;
    const modifiedTime = file.modifiedTime ? new Date(file.modifiedTime) : new Date();
    return {
      fileId: file.id!,
      revisionId: file.headRevisionId ?? file.version,
      uploadedAt: modifiedTime,
      syncedAt: modifiedTime,
      metadata: {
        size: file.size,
        md5Checksum: file.md5Checksum,
        ...uploadMetadata,
      },
    };
  }

  async syncDocument(document: DocumentEntity): Promise<DriveUploadResult> {
    const driveConfig = this.configService.get('drive', { infer: true });

    if (driveConfig.emulatorUrl) {
      const response = await axios.get(
        new URL(`/files/${document.driveFileId}`, driveConfig.emulatorUrl).toString(),
      );
      const modifiedTime = response.data.modifiedTime ?? response.data.updated ?? Date.now();
      return {
        fileId: response.data.id,
        revisionId: response.data.headRevisionId ?? response.data.version,
        uploadedAt: document.uploadedAt ?? new Date(modifiedTime),
        syncedAt: new Date(modifiedTime),
        metadata: response.data,
      };
    }

    const drive = await this.getDriveClient();
    if (!drive) {
      throw new Error('Google Drive client is not configured');
    }

    const response = await drive.files.get({
      fileId: document.driveFileId!,
      supportsAllDrives: true,
      fields: 'id, name, mimeType, size, md5Checksum, version, headRevisionId, modifiedTime',
    });
    const file = response.data;
    const modifiedTime = file.modifiedTime ? new Date(file.modifiedTime) : new Date();
    return {
      fileId: file.id!,
      revisionId: file.headRevisionId ?? file.version,
      uploadedAt: document.uploadedAt ?? modifiedTime,
      syncedAt: modifiedTime,
      metadata: {
        size: file.size,
        md5Checksum: file.md5Checksum,
      },
    };
  }

  private async resolveMedia(document: DocumentEntity): Promise<{ mimeType?: string; body: Readable } | null> {
    if (!document.sourceUri) {
      return null;
    }

    const mimeType = document.mimeType ?? undefined;
    if (document.sourceUri.startsWith('http')) {
      const response = await axios.get(document.sourceUri, { responseType: 'stream' });
      return { mimeType, body: response.data as Readable };
    }

    const filePath = document.sourceUri.startsWith('file://')
      ? document.sourceUri.replace('file://', '')
      : document.sourceUri;
    const absolutePath = resolve(filePath);
    if (!existsSync(absolutePath)) {
      this.logger.warn(`Источник ${absolutePath} не найден, создадим пустой файл в Google Drive`);
      return null;
    }

    return { mimeType, body: createReadStream(absolutePath) };
  }

  private async getDriveClient(): Promise<drive_v3.Drive | undefined> {
    if (this.driveClient) {
      return this.driveClient;
    }

    const driveConfig = this.configService.get('drive', { infer: true });
    const credentialsSource = driveConfig.serviceAccountJson
      ? driveConfig.serviceAccountJson
      : this.safeReadCredentialsFile(driveConfig.credentialsPath);

    if (!credentialsSource) {
      this.logger.warn('Сервисный аккаунт для Google Drive не настроен');
      return undefined;
    }

    const credentials = JSON.parse(credentialsSource);

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/drive'],
      subject: credentials.client_email,
    });

    this.driveClient = google.drive({ version: 'v3', auth });
    return this.driveClient;
  }

  private safeReadCredentialsFile(path?: string): string | null {
    if (!path) {
      return null;
    }
    try {
      if (existsSync(path)) {
        return readFileSync(path, 'utf-8');
      }
      return null;
    } catch (error) {
      this.logger.error(`Не удалось прочитать файл сервисного аккаунта: ${error}`);
      return null;
    }
  }
}
