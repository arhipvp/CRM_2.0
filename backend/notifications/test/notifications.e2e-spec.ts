import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { NotificationsApiController } from '../src/notifications/notifications.api.controller';
import { NotificationsService } from '../src/notifications/notifications.service';
import { NotificationEntity } from '../src/notifications/notification.entity';
import { NotificationDeliveryAttemptEntity } from '../src/notifications/notification-delivery-attempt.entity';
import { ConfigService } from '@nestjs/config';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { NotificationEventsService } from '../src/notifications/notification-events.service';
import { Repository } from 'typeorm';

describe('Notifications API (e2e)', () => {
  let app: INestApplication;
  let testingModule: TestingModule;
  let notificationsRepository: Repository<NotificationEntity>;
  let attemptsRepository: Repository<NotificationDeliveryAttemptEntity>;
  let dedupPayload: Record<string, unknown>;

  const amqpPublish = jest.fn().mockResolvedValue(undefined);
  const redisPublish = jest.fn().mockResolvedValue(1);
  const redisServiceMock = {
    getOrThrow: jest.fn().mockReturnValue({ publish: redisPublish })
  };
  const eventsHandler = jest.fn().mockResolvedValue(undefined);

  const configMock = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'rabbitmq.exchange':
          return 'notifications.exchange';
        case 'rabbitmq.outgoingRoutingKey':
          return 'notifications.created';
        case 'redis.notificationsChannel':
          return 'notifications:events';
        default:
          return undefined;
      }
    })
  };

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          entities: [NotificationEntity, NotificationDeliveryAttemptEntity],
          synchronize: true
        }),
        TypeOrmModule.forFeature([NotificationEntity, NotificationDeliveryAttemptEntity])
      ],
      controllers: [NotificationsApiController],
      providers: [
        NotificationsService,
        {
          provide: ConfigService,
          useValue: configMock
        },
        {
          provide: AmqpConnection,
          useValue: { publish: amqpPublish }
        },
        {
          provide: RedisService,
          useValue: redisServiceMock
        },
        {
          provide: NotificationEventsService,
          useValue: { handleIncoming: eventsHandler }
        }
      ]
    }).compile();

    notificationsRepository = testingModule.get(getRepositoryToken(NotificationEntity));
    attemptsRepository = testingModule.get(getRepositoryToken(NotificationDeliveryAttemptEntity));

    app = testingModule.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: (errors) =>
          new BadRequestException({
            code: 'validation_error',
            message: 'Request validation failed.',
            errors
          })
      })
    );
    app.setGlobalPrefix('api');
    await app.init();

    dedupPayload = {
      event_key: 'deal.status.changed',
      recipients: [
        {
          user_id: 'user-1',
          telegram_id: '123'
        }
      ],
      payload: {
        deal_id: 'deal-1',
        status: 'won'
      },
      channel_overrides: ['telegram'],
      deduplication_key: 'deal-1:won'
    };
  });

  afterAll(async () => {
    await app.close();
    await testingModule.close();
  });

  beforeEach(async () => {
    await attemptsRepository.clear();
    await notificationsRepository.clear();
    jest.clearAllMocks();
  });

  it('creates notification and returns 202', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/notifications')
      .send(dedupPayload)
      .expect(202);

    expect(response.body).toHaveProperty('notification_id');
    const saved = await notificationsRepository.findOneBy({ id: response.body.notification_id });
    expect(saved).not.toBeNull();
    expect(saved?.eventKey).toBe('deal.status.changed');
  });

  it('rejects duplicates with 409 and error code', async () => {
    await request(app.getHttpServer()).post('/api/v1/notifications').send(dedupPayload).expect(202);

    const response = await request(app.getHttpServer())
      .post('/api/v1/notifications')
      .send(dedupPayload)
      .expect(409);

    expect(response.body.code).toBe('duplicate_notification');
  });

  it('validates payload and returns structured error', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/notifications')
      .send({})
      .expect(400);

    expect(response.body.code).toBe('validation_error');
    expect(response.body.errors).toBeDefined();
  });
});
