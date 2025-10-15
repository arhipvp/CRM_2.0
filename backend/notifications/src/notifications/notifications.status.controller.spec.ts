/// <reference types="jest" />

import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { DataType, newDb } from 'pg-mem';
import { NotificationsStatusController } from './notifications.status.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEntity, NotificationStatus } from './notification.entity';
import {
  NotificationDeliveryAttemptEntity,
  NotificationDeliveryAttemptStatus
} from './notification-delivery-attempt.entity';
import { NotificationEventEntity } from './notification-event.entity';
import { NotificationEventsService } from './notification-events.service';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ConfigService } from '@nestjs/config';
import { NotificationsConfiguration } from '../config/configuration';

describe('NotificationsStatusController (e2e)', () => {
  let app: INestApplication;
  let notificationsRepository: Repository<NotificationEntity>;
  let attemptsRepository: Repository<NotificationDeliveryAttemptEntity>;
  let eventsRepository: Repository<NotificationEventEntity>;
  let dataSource: DataSource;

  const eventsServiceMock = {
    handleIncoming: jest.fn()
  } as unknown as NotificationEventsService;

  const amqpMock = { publish: jest.fn() } as unknown as AmqpConnection;
  const redisMock = {
    getOrThrow: jest.fn(() => ({ publish: jest.fn() }))
  } as unknown as RedisService;
  const configServiceMock: Partial<ConfigService<NotificationsConfiguration>> = {
    get: jest.fn(),
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
      controllers: [NotificationsStatusController],
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(NotificationEntity), useValue: notificationsRepository },
        { provide: getRepositoryToken(NotificationDeliveryAttemptEntity), useValue: attemptsRepository },
        { provide: getRepositoryToken(NotificationEventEntity), useValue: eventsRepository },
        { provide: NotificationEventsService, useValue: eventsServiceMock },
        { provide: AmqpConnection, useValue: amqpMock },
        { provide: RedisService, useValue: redisMock },
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
    await attemptsRepository.createQueryBuilder().delete().execute();
    await notificationsRepository.createQueryBuilder().delete().execute();
    await eventsRepository.createQueryBuilder().delete().execute();
  });

  it('returns aggregated status for existing notification', async () => {
    const notification = notificationsRepository.create({
      eventKey: 'deal.created',
      recipients: [{ userId: 'user-1', telegramId: '1000' }],
      payload: { dealId: '123' },
      channelOverrides: ['telegram'],
      deduplicationKey: null,
      status: NotificationStatus.PROCESSED,
      attemptsCount: 2,
      lastAttemptAt: new Date('2024-03-01T12:00:00.000Z'),
      lastError: null
    });
    await notificationsRepository.save(notification);

    const attemptEntities = [
      attemptsRepository.create({
        id: randomUUID(),
        notificationId: notification.id,
        attemptNumber: 1,
        channel: 'events-service',
        status: NotificationDeliveryAttemptStatus.SUCCESS,
        metadata: {},
        error: null
      }),
      attemptsRepository.create({
        id: randomUUID(),
        notificationId: notification.id,
        attemptNumber: 2,
        channel: 'rabbitmq',
        status: NotificationDeliveryAttemptStatus.SUCCESS,
        metadata: {},
        error: null
      })
    ];
    await attemptsRepository.save(attemptEntities);

    const deliveredAt = new Date('2024-03-01T13:00:00.000Z');
    const eventEntity = eventsRepository.create({
      eventId: randomUUID(),
      eventType: 'notifications.telegram.delivery',
      payload: { notificationId: notification.id, status: 'delivered' },
      deliveredToTelegram: true,
      telegramMessageId: 'msg-1',
      telegramDeliveryStatus: 'delivered',
      telegramDeliveryReason: null,
      telegramDeliveryOccurredAt: deliveredAt
    });
    await eventsRepository.save(eventEntity);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/notifications/${notification.id}`)
      .expect(200);

    expect(response.body).toEqual({
      id: notification.id,
      status: 'delivered',
      attempts: 2,
      channels: ['events-service', 'rabbitmq'],
      delivered_at: deliveredAt.toISOString()
    });
  });

  it('returns 404 when notification is missing', async () => {
    const unknownId = randomUUID();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/notifications/${unknownId}`)
      .expect(404);

    expect(response.body.message).toBe('notification_not_found');
  });
});
