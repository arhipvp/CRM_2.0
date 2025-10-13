/// <reference types="jest" />

import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { DataType, newDb } from 'pg-mem';
import { NotificationsDispatchController } from './notifications.dispatch.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEntity, NotificationStatus } from './notification.entity';
import { NotificationDeliveryAttemptEntity } from './notification-delivery-attempt.entity';
import { NotificationEventEntity } from './notification-event.entity';
import { NotificationEventsService } from './notification-events.service';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ConfigService } from '@nestjs/config';
import { NotificationsConfiguration } from '../config/configuration';

describe('NotificationsDispatchController (e2e)', () => {
  let app: INestApplication;
  let notificationsRepository: Repository<NotificationEntity>;
  let attemptsRepository: Repository<NotificationDeliveryAttemptEntity>;
  let eventsRepository: Repository<NotificationEventEntity>;
  let dataSource: DataSource;

  const amqpPublishMock = jest.fn();
  const redisPublishMock = jest.fn();
  const eventsServiceMock = {
    handleIncoming: jest.fn()
  };

  const redisServiceMock = {
    getOrThrow: jest.fn(() => ({ publish: redisPublishMock }))
  } as unknown as RedisService;

  const configServiceMock: Partial<ConfigService<NotificationsConfiguration>> = {
    get: jest.fn((key: string) => {
      if (key === 'sse.retryInterval') {
        return 5000;
      }
      return undefined;
    }),
    getOrThrow: jest.fn((key: string) => {
      if (key === 'dispatch.exchange') {
        return 'notifications.exchange';
      }
      if (key === 'dispatch.routingKey') {
        return 'notifications.dispatch';
      }
      if (key === 'dispatch.redisChannel') {
        return 'notifications:dispatch';
      }
      throw new Error(`Unexpected config key ${key}`);
    })
  };

  beforeAll(async () => {
    const db = newDb({ autoCreateForeignKeyIndices: true });
    db.public.registerFunction({ name: 'version', returns: DataType.text, implementation: () => 'PostgreSQL 14.0' });
    db.public.registerFunction({ name: 'current_database', returns: DataType.text, implementation: () => 'notifications' });
    db.public.registerFunction({ name: 'uuid_generate_v4', returns: DataType.uuid, implementation: () => randomUUID() });

    dataSource = await db.adapters.createTypeormDataSource({
      type: 'postgres',
      entities: [NotificationEntity, NotificationDeliveryAttemptEntity, NotificationEventEntity],
      synchronize: true
    });
    await dataSource.initialize();

    notificationsRepository = dataSource.getRepository(NotificationEntity);
    attemptsRepository = dataSource.getRepository(NotificationDeliveryAttemptEntity);
    eventsRepository = dataSource.getRepository(NotificationEventEntity);

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsDispatchController],
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(NotificationEntity), useValue: notificationsRepository },
        { provide: getRepositoryToken(NotificationDeliveryAttemptEntity), useValue: attemptsRepository },
        { provide: NotificationEventsService, useValue: eventsServiceMock },
        { provide: AmqpConnection, useValue: { publish: amqpPublishMock } },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: ConfigService, useValue: configServiceMock }
      ]
    }).compile();

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
    if (app) {
      await app.close();
    }
    await dataSource.destroy();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    amqpPublishMock.mockResolvedValue(undefined);
    redisPublishMock.mockResolvedValue(1);
    eventsServiceMock.handleIncoming.mockResolvedValue(undefined);
    (redisServiceMock.getOrThrow as unknown as jest.Mock).mockReturnValue({ publish: redisPublishMock });
    await attemptsRepository.createQueryBuilder().delete().execute();
    await notificationsRepository.createQueryBuilder().delete().execute();
    await eventsRepository.createQueryBuilder().delete().execute();
  });

  it('accepts notification and returns identifier', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/notifications')
      .send({
        eventKey: 'deal.created',
        recipients: [{ userId: 'user-1', telegramId: '1000' }],
        payload: { dealId: '123' },
        channelOverrides: ['telegram'],
        deduplicationKey: 'deal:123'
      })
      .expect(202);

    expect(response.body.notification_id).toBeDefined();
    expect(amqpPublishMock).toHaveBeenCalledTimes(1);
    expect(redisPublishMock).toHaveBeenCalledTimes(1);
    expect(eventsServiceMock.handleIncoming).toHaveBeenCalledTimes(1);

    const stored = await notificationsRepository.findOneBy({ id: response.body.notification_id });
    expect(stored).not.toBeNull();
    expect(stored?.status).toBe(NotificationStatus.PROCESSED);
    expect(stored?.attemptsCount).toBe(3);

    const attempts = await attemptsRepository.find({ where: { notificationId: response.body.notification_id } });
    expect(attempts).toHaveLength(3);
  });

  it('returns conflict for duplicate deduplication key', async () => {
    const payload = {
      eventKey: 'deal.updated',
      recipients: [{ userId: 'user-1' }],
      payload: { dealId: '123' },
      deduplicationKey: 'deal:dup'
    };

    await request(app.getHttpServer()).post('/api/v1/notifications').send(payload).expect(202);

    const duplicateResponse = await request(app.getHttpServer())
      .post('/api/v1/notifications')
      .send(payload)
      .expect(409);

    expect(duplicateResponse.body.message).toBe('duplicate_notification');
  });

  it('validates payload and returns 400 for invalid body', async () => {
    const invalidResponse = await request(app.getHttpServer())
      .post('/api/v1/notifications')
      .send({
        eventKey: '',
        recipients: 'invalid',
        payload: {}
      })
      .expect(400);

    expect(invalidResponse.body.message).toBeDefined();
  });
});
