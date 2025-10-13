/// <reference types="jest" />

import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { DataType, newDb } from 'pg-mem';
import { TemplatesModule } from './templates.module';
import {
  NotificationTemplateChannel,
  NotificationTemplateEntity,
  NotificationTemplateStatus
} from './notification-template.entity';
import { ConfigService } from '@nestjs/config';

describe('TemplatesController (e2e)', () => {
  let app: INestApplication;
  let repository: Repository<NotificationTemplateEntity>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const db = newDb({ autoCreateForeignKeyIndices: true });
    db.public.registerFunction({ name: 'version', returns: DataType.text, implementation: () => 'PostgreSQL 14.0' });
    db.public.registerFunction({ name: 'current_database', returns: DataType.text, implementation: () => 'notifications' });
    db.public.registerFunction({ name: 'uuid_generate_v4', returns: DataType.uuid, implementation: () => randomUUID() });

    dataSource = await db.adapters.createTypeormDataSource({
      type: 'postgres',
      entities: [NotificationTemplateEntity],
      synchronize: true
    });
    await dataSource.initialize();
    repository = dataSource.getRepository(NotificationTemplateEntity);

    const configServiceMock: Partial<ConfigService> = {
      get: jest.fn((key: string) => {
        if (key === 'templates.defaultLocale') {
          return 'ru-RU';
        }
        return undefined;
      })
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [TemplatesModule]
    })
      .overrideProvider(getRepositoryToken(NotificationTemplateEntity))
      .useValue(repository)
      .overrideProvider(ConfigService)
      .useValue(configServiceMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true }
      })
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await repository.clear();
    await repository.save([
      repository.create({
        id: randomUUID(),
        key: 'deal.created',
        channel: NotificationTemplateChannel.SSE,
        locale: 'ru-RU',
        body: 'Deal created',
        metadata: { preview: 'Создана сделка' },
        status: NotificationTemplateStatus.ACTIVE
      }),
      repository.create({
        id: randomUUID(),
        key: 'deal.closed',
        channel: NotificationTemplateChannel.TELEGRAM,
        locale: 'ru-RU',
        body: 'Deal closed',
        metadata: {},
        status: NotificationTemplateStatus.INACTIVE
      })
    ]);
  });

  it('creates template with default locale', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/templates')
      .send({
        key: 'deal.updated',
        channel: NotificationTemplateChannel.TELEGRAM,
        body: 'Deal updated',
        metadata: { preview: 'Обновление сделки' }
      })
      .expect(201);

    expect(response.body).toMatchObject({
      key: 'deal.updated',
      channel: NotificationTemplateChannel.TELEGRAM,
      locale: 'ru-RU',
      status: NotificationTemplateStatus.ACTIVE
    });

    const stored = await repository.findOneBy({
      key: 'deal.updated',
      channel: NotificationTemplateChannel.TELEGRAM
    });
    expect(stored).not.toBeNull();
    expect(stored?.metadata).toMatchObject({ preview: 'Обновление сделки' });
  });

  it('throws conflict when template with same key and channel exists', async () => {
    const conflictResponse = await request(app.getHttpServer())
      .post('/api/v1/templates')
      .send({
        key: 'deal.created',
        channel: NotificationTemplateChannel.SSE,
        body: 'Deal created again'
      })
      .expect(409);

    expect(conflictResponse.body.message).toBe('template_conflict');
  });

  it('filters templates by channel and activity flag', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/templates')
      .query({ channel: NotificationTemplateChannel.TELEGRAM, active: false })
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      key: 'deal.closed',
      channel: NotificationTemplateChannel.TELEGRAM,
      status: NotificationTemplateStatus.INACTIVE
    });
  });
});
