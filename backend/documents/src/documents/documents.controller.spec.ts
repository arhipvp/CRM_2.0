import { ConflictException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { DocumentsController } from './documents.controller';
import { DocumentsQueueService } from './documents-queue.service';
import { DocumentsService } from './documents.service';

describe('DocumentsController', () => {
  let app: INestApplication;
  let documentsService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let documentsQueue: { enqueueUpload: jest.Mock; enqueueSync: jest.Mock };

  beforeEach(async () => {
    documentsService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    documentsQueue = {
      enqueueUpload: jest.fn(),
      enqueueSync: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: documentsService },
        { provide: DocumentsQueueService, useValue: documentsQueue },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('DELETE /documents/:id возвращает 204 при успешном удалении', async () => {
    documentsService.remove.mockResolvedValue(undefined);

    await request(app.getHttpServer()).delete('/documents/doc-1').expect(204);

    expect(documentsService.remove).toHaveBeenCalledWith('doc-1');
  });

  it('DELETE /documents/:id возвращает 409 already_deleted при повторном удалении', async () => {
    documentsService.remove.mockRejectedValue(
      new ConflictException({
        statusCode: 409,
        code: 'already_deleted',
        message: 'Документ doc-1 уже удалён',
      }),
    );

    const response = await request(app.getHttpServer()).delete('/documents/doc-1');

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'already_deleted',
      message: 'Документ doc-1 уже удалён',
    });
  });
});
