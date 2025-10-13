import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { DriveService } from '../drive/drive.service';
import { DocumentStatus } from './document-status.enum';
import { DocumentEntity } from './document.entity';
import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let repository: jest.Mocked<Repository<DocumentEntity>>;
  let driveService: jest.Mocked<DriveService>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<DocumentEntity>>;

    driveService = {
      revokeDocument: jest.fn(),
    } as unknown as jest.Mocked<DriveService>;

    service = new DocumentsService(repository, driveService);
  });

  it('исключает удалённые документы из поиска', async () => {
    repository.findAndCount.mockResolvedValue([[], 0]);

    await service.findAll({});

    const args = repository.findAndCount.mock.calls[0][0] as Record<string, any>;
    expect(args.where.deletedAt).toMatchObject({ _type: 'isNull' });
  });

  it('помечает документ удалённым и отзывает файл', async () => {
    const document: DocumentEntity = {
      id: 'doc-1',
      name: 'Test',
      status: DocumentStatus.Synced,
      createdAt: new Date(),
      updatedAt: new Date(),
      driveFileId: 'drive-1',
      driveRevisionId: 'rev-1',
    } as DocumentEntity;
    repository.findOne.mockResolvedValue(document);

    await service.remove(document.id);

    expect(repository.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({ deletedAt: expect.objectContaining({ _type: 'isNull' }) }),
    });
    expect(driveService.revokeDocument).toHaveBeenCalledWith(document);
    expect(repository.save).toHaveBeenCalled();
    const saved = repository.save.mock.calls[0][0];
    expect(saved.deletedAt).toBeInstanceOf(Date);
    expect(saved.driveFileId).toBeNull();
    expect(saved.driveRevisionId).toBeNull();
    expect(saved.status).toBe(DocumentStatus.Draft);
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it('бросает исключение, если документ не найден', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
