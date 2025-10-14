import { createHash } from 'crypto';
import { createReadStream, Stats } from 'fs';
import { promises as fs } from 'fs';
import { dirname, extname, posix, relative, resolve } from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DocumentsConfiguration } from '../config/configuration';
import { DocumentEntity } from '../documents/document.entity';

export interface StorageDirectory {
  path: string;
  fullPath: string;
  publicUrl: string | null;
  metadata?: Record<string, any>;
}

export interface StorageUploadResult {
  path: string;
  publicUrl: string | null;
  uploadedAt: Date;
  syncedAt: Date;
  size?: number | null;
  checksumMd5?: string | null;
  metadata?: Record<string, any>;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly configService: ConfigService<DocumentsConfiguration, true>) {}

  async createFolder(name: string, parentPath?: string | null): Promise<StorageDirectory> {
    const safeName = this.sanitizeSegment(name);
    const parent = parentPath ? this.normalizeRelativePath(parentPath) : '';
    const relativePath = parent ? posix.join(parent, safeName) : safeName;
    const absolutePath = this.resolveAbsolute(relativePath);

    await fs.mkdir(absolutePath, { recursive: true });

    return {
      path: relativePath,
      fullPath: absolutePath,
      publicUrl: this.buildPublicUrl(relativePath),
      metadata: { name: safeName, parent: parent || null },
    };
  }

  async uploadDocument(
    document: DocumentEntity,
    metadata?: Record<string, any>,
  ): Promise<StorageUploadResult> {
    const relativePath = this.ensureDocumentPath(document);
    const absolutePath = this.resolveAbsolute(relativePath);
    await fs.mkdir(dirname(absolutePath), { recursive: true });

    let uploadedAt = document.uploadedAt ?? new Date();
    let size = document.size ? Number(document.size) : null;
    let checksum = document.checksumMd5 ?? null;

    if (document.sourceUri) {
      const sourcePath = this.resolveSourcePath(document.sourceUri);
      try {
        await fs.copyFile(sourcePath, absolutePath);
        const stats = await fs.stat(absolutePath);
        uploadedAt = stats.mtime;
        size = stats.size;
        checksum = await this.computeChecksum(absolutePath);
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`Не удалось скопировать файл из ${sourcePath}: ${err.message}`);
      }
    }

    const attributes = await this.collectFileAttributes(absolutePath);
    if (attributes) {
      size = attributes.stats.size;
      checksum = attributes.checksum;
      uploadedAt = attributes.stats.mtime;
    }

    const now = new Date();

    return {
      path: relativePath,
      publicUrl: this.buildPublicUrl(relativePath),
      uploadedAt,
      syncedAt: now,
      size,
      checksumMd5: checksum,
      metadata,
    };
  }

  async syncDocument(document: DocumentEntity): Promise<StorageUploadResult> {
    if (!document.storagePath) {
      throw new Error(`Документ ${document.id} не содержит пути в хранилище`);
    }

    const relativePath = this.normalizeRelativePath(document.storagePath);
    const absolutePath = this.resolveAbsolute(relativePath);
    const attributes = await this.collectFileAttributes(absolutePath);
    const now = new Date();

    return {
      path: relativePath,
      publicUrl: this.buildPublicUrl(relativePath),
      uploadedAt: document.uploadedAt ?? attributes?.stats.mtime ?? now,
      syncedAt: attributes?.stats.mtime ?? now,
      size: attributes?.stats.size ?? (document.size ? Number(document.size) : null),
      checksumMd5: attributes?.checksum ?? document.checksumMd5 ?? null,
      metadata: attributes?.metadata,
    };
  }

  async revokeDocument(document: DocumentEntity): Promise<void> {
    if (!document.storagePath) {
      return;
    }

    const relativePath = this.normalizeRelativePath(document.storagePath);
    const absolutePath = this.resolveAbsolute(relativePath);

    try {
      await fs.rm(absolutePath, { force: true });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return;
      }
      this.logger.warn(`Не удалось удалить файл ${absolutePath}: ${err.message}`);
    }
  }

  getAbsolutePath(relativePath: string): string {
    return this.resolveAbsolute(relativePath);
  }

  getPublicUrl(relativePath: string): string | null {
    return this.buildPublicUrl(relativePath);
  }

  private get rootPath(): string {
    const root = this.configService.get('storage.root', { infer: true });
    return resolve(root);
  }

  private ensureDocumentPath(document: DocumentEntity): string {
    if (document.storagePath) {
      return this.normalizeRelativePath(document.storagePath);
    }

    const metadata = document.metadata ?? {};
    const ownerType = this.sanitizeSegment(String(metadata.ownerType ?? 'misc'));
    const ownerId = this.sanitizeSegment(String(metadata.ownerId ?? document.id));
    const extension = extname(document.name ?? '') || '';
    return posix.join(ownerType, ownerId, `${document.id}${extension}`);
  }

  private sanitizeSegment(value: string): string {
    const trimmed = value.trim().replace(/[\r\n]+/g, ' ');
    const sanitized = trimmed.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ');
    const safe = sanitized.replace(/^\.+$/, '');
    return safe || 'untitled';
  }

  private normalizeRelativePath(input: string): string {
    const sanitized = input.replace(/\\+/g, '/');
    const normalized = posix.normalize(sanitized);
    if (normalized === '.' || normalized === './') {
      return '';
    }
    if (normalized.startsWith('..')) {
      throw new Error(`Недопустимый относительный путь: ${input}`);
    }
    return normalized.replace(/^\/+/, '');
  }

  private resolveAbsolute(relativePath: string): string {
    const normalized = this.normalizeRelativePath(relativePath);
    const segments = normalized ? normalized.split('/') : [];
    const absolute = resolve(this.rootPath, ...segments);
    const relativePathCheck = relative(this.rootPath, absolute);
    if (relativePathCheck.startsWith('..') || relativePathCheck === '..') {
      throw new Error(`Путь ${relativePath} выходит за пределы каталога хранилища`);
    }
    return absolute;
  }

  private resolveSourcePath(source: string): string {
    if (source.startsWith('file://')) {
      const url = new URL(source);
      return decodeURIComponent(url.pathname);
    }

    if (source.startsWith('/')) {
      return source;
    }

    return resolve(process.cwd(), source);
  }

  private async collectFileAttributes(filePath: string): Promise<
    | { stats: Stats; checksum: string | null; metadata?: Record<string, any> }
    | null
  > {
    try {
      const stats = await fs.stat(filePath);
      const checksum = await this.computeChecksum(filePath);
      return { stats, checksum };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  private async computeChecksum(filePath: string): Promise<string | null> {
    try {
      return await new Promise<string>((resolvePromise, rejectPromise) => {
        const hash = createHash('md5');
        const stream = createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('error', (error) => rejectPromise(error));
        stream.on('end', () => resolvePromise(hash.digest('hex')));
      });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return null;
      }
      this.logger.warn(`Не удалось вычислить хэш файла ${filePath}: ${err.message}`);
      return null;
    }
  }

  private buildPublicUrl(relativePath: string): string | null {
    const base = this.configService.get('storage.publicBaseUrl', { infer: true });
    if (!base) {
      return null;
    }
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    const normalizedPath = this.normalizeRelativePath(relativePath).split('/').join('/');
    return `${normalizedBase}${normalizedPath}`;
  }
}
