import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { DocumentsController } from './documents.controller';
import { DocumentsQueueService } from './documents-queue.service';
import { DocumentsService } from './documents.service';
import { DocumentAlreadyDeletedException } from './documents.exceptions';

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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        forbidUnknownValues: false,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /documents возвращает массив документов и заголовок X-Total-Count', async () => {
    const documents = [
      { id: 'doc-1', name: 'Полис', status: 'synced', createdAt: new Date().toISOString() },
    ];
    documentsService.findAll.mockResolvedValue([documents, 32]);

    const response = await request(app.getHttpServer()).get('/documents');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(documents);
    expect(response.headers['x-total-count']).toBe('32');
    expect(documentsService.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 25, offset: 0 }));
  });

  it('DELETE /documents/:id возвращает 204 при успешном удалении', async () => {
    documentsService.remove.mockResolvedValue(undefined);

    await request(app.getHttpServer()).delete('/documents/doc-1').expect(204);

    expect(documentsService.remove).toHaveBeenCalledWith('doc-1');
  });

  it('POST /documents создаёт документ, возвращает ссылку на загрузку и ставит задачу в очередь', async () => {
    const payload = {
      owner_type: 'client',
      owner_id: 'f33cd3e3-68c0-4e1a-9a2f-6cf3f55f3f77',
      title: 'Страховой полис',
      document_type: 'policy',
      notes: 'Оригинал договора',
      tags: ['insurance', '2024'],
    };

    const metadata = {
      ownerType: 'client',
      ownerId: payload.owner_id,
      documentType: payload.document_type,
      notes: payload.notes,
      tags: payload.tags,
    };

    documentsService.create.mockResolvedValue({
      document: { id: 'doc-1', metadata },
      uploadUrl: 'https://storage.local/documents/doc-1?token=abc',
      expiresIn: 900,
    });
    documentsQueue.enqueueUpload.mockResolvedValue('job-1');

    const response = await request(app.getHttpServer()).post('/documents').send(payload);

    expect(response.status).toBe(201);

    expect(documentsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: 'client',
        ownerId: payload.owner_id,
        title: payload.title,
        documentType: payload.document_type,
        notes: payload.notes,
        tags: payload.tags,
      }),
    );
    expect(documentsQueue.enqueueUpload).toHaveBeenCalledWith('doc-1', metadata);
    expect(response.body).toEqual({
      document_id: 'doc-1',
      upload_url: 'https://storage.local/documents/doc-1?token=abc',
      expires_in: 900,
    });
  });

  it('DELETE /documents/:id возвращает 409 already_deleted при повторном удалении', async () => {
    documentsService.remove.mockRejectedValue(new DocumentAlreadyDeletedException('doc-1'));

    const response = await request(app.getHttpServer()).delete('/documents/doc-1');

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'already_deleted',
      message: 'Документ doc-1 уже удалён',
    });
  });
});
