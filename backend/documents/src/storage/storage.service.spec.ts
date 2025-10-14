import { createHash } from 'crypto';
import { promises as fs, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

import { ConfigService } from '@nestjs/config';

import { DocumentsConfiguration } from '../config/configuration';
import { DocumentEntity } from '../documents/document.entity';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let storageRoot: string;
  let sourceRoot: string;
  let service: StorageService;

  beforeEach(() => {
    storageRoot = mkdtempSync(join(tmpdir(), 'documents-storage-'));
    sourceRoot = mkdtempSync(join(tmpdir(), 'documents-source-'));

    const configService = new ConfigService<DocumentsConfiguration, true>({
      storage: {
        root: storageRoot,
        quotaMb: null,
        publicBaseUrl: 'https://files.local/documents',
        uploadBaseUrl: 'https://upload.local/documents',
        uploadTtlSeconds: 900,
      },
    } as unknown as DocumentsConfiguration);

    service = new StorageService(configService);
  });

  afterEach(async () => {
    await fs.rm(storageRoot, { recursive: true, force: true });
    await fs.rm(sourceRoot, { recursive: true, force: true });
  });

  it('создаёт вложенную директорию с безопасным именем', async () => {
    const directory = await service.createFolder('Client / 001', 'clients');

    expect(directory.path).toBe('clients/Client - 001');
    expect(directory.fullPath).toBe(resolve(storageRoot, 'clients/Client - 001'));
    expect(directory.publicUrl).toBe('https://files.local/documents/clients/Client - 001');
    expect(directory.metadata).toEqual({ name: 'Client - 001', parent: 'clients' });
  });

  it('копирует файл из источника и возвращает контрольную сумму', async () => {
    const sourceFile = join(sourceRoot, 'original.txt');
    writeFileSync(sourceFile, 'hello storage');

    const document = {
      id: 'doc-1',
      name: 'original.txt',
      metadata: { ownerType: 'deal', ownerId: '42' },
      sourceUri: `file://${sourceFile}`,
    } as unknown as DocumentEntity;

    const result = await service.uploadDocument(document, { uploadedBy: 'tester' });

    const storedFile = resolve(storageRoot, result.path);
    const storedContent = await fs.readFile(storedFile, 'utf8');

    expect(storedContent).toBe('hello storage');
    expect(result.publicUrl).toBe('https://files.local/documents/deal/42/doc-1.txt');
    expect(result.metadata).toEqual({ uploadedBy: 'tester' });

    const expectedChecksum = createHash('md5').update('hello storage').digest('hex');
    expect(result.checksumMd5).toBe(expectedChecksum);
  });

  it('синхронизирует существующий документ и возвращает актуальные атрибуты', async () => {
    const sourceFile = join(sourceRoot, 'sync.txt');
    writeFileSync(sourceFile, 'sync content');

    const baseDocument = {
      id: 'doc-sync',
      name: 'sync.txt',
      metadata: { ownerType: 'policy', ownerId: '77' },
      sourceUri: `file://${sourceFile}`,
    } as unknown as DocumentEntity;

    const upload = await service.uploadDocument(baseDocument);

    const entityForSync = {
      id: baseDocument.id,
      storagePath: upload.path,
      uploadedAt: upload.uploadedAt,
      size: upload.size ? String(upload.size) : null,
      checksumMd5: upload.checksumMd5 ?? null,
    } as unknown as DocumentEntity;

    const syncResult = await service.syncDocument(entityForSync);

    expect(syncResult.path).toBe(upload.path);
    expect(syncResult.size).toBe(upload.size);
    expect(syncResult.checksumMd5).toBe(upload.checksumMd5);
    expect(syncResult.syncedAt.getTime()).toBeGreaterThan(0);
    expect(syncResult.publicUrl).toBe('https://files.local/documents/policy/77/doc-sync.txt');
  });
});
