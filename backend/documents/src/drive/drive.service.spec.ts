import axios from 'axios';
import { ConfigService } from '@nestjs/config';

import { DriveService, DriveUploadResult } from './drive.service';
import { DocumentsConfiguration } from '../config/configuration';
import { DocumentEntity } from '../documents/document.entity';

jest.mock('axios');

describe('DriveService', () => {
  let service: DriveService;
  let configService: jest.Mocked<ConfigService<DocumentsConfiguration, true>>;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'drive') {
          return {
            emulatorUrl: 'http://localhost:9000',
            emulatorRoot: 'root',
          } as DocumentsConfiguration['drive'];
        }
        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as jest.Mocked<ConfigService<DocumentsConfiguration, true>>;

    service = new DriveService(configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('успешно загружает документ без метаданных', async () => {
    const document = {
      id: 'doc-1',
      name: 'Document without metadata',
      metadata: null,
      description: null,
      mimeType: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    } as unknown as DocumentEntity;

    const modifiedTime = new Date('2024-01-01T00:00:01Z').toISOString();

    mockedAxios.post.mockResolvedValue({
      data: {
        id: 'drive-file-id',
        headRevisionId: '1',
        modifiedTime,
      },
    });

    const result = await service.uploadDocument(document);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      new URL('/files', 'http://localhost:9000').toString(),
      expect.objectContaining({
        metadata: {},
      }),
    );

    expect(result).toMatchObject<Partial<DriveUploadResult>>({
      fileId: 'drive-file-id',
      revisionId: '1',
      metadata: {
        id: 'drive-file-id',
        headRevisionId: '1',
        modifiedTime,
      },
    });
  });

  it('отзывает файл в эмуляторе', async () => {
    const document = {
      driveFileId: 'drive-file-id',
    } as DocumentEntity;

    mockedAxios.delete.mockResolvedValue({ status: 204 } as never);

    await service.revokeDocument(document);

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      new URL(`/files/${document.driveFileId}`, 'http://localhost:9000').toString(),
    );
  });

  it('пропускает отзыв, если файл не связан', async () => {
    const document = { driveFileId: null } as DocumentEntity;

    await service.revokeDocument(document);

    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it('создаёт папку в эмуляторе Google Drive', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { id: 'drive-folder-id', name: 'Client 123' },
    });

    const folder = await service.createFolder('Client 123');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      new URL('/files', 'http://localhost:9000').toString(),
      expect.objectContaining({
        name: 'Client 123',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['root'],
      }),
    );

    expect(folder).toEqual({
      id: 'drive-folder-id',
      name: 'Client 123',
      webViewLink: null,
      metadata: { id: 'drive-folder-id', name: 'Client 123' },
    });
  });
});
