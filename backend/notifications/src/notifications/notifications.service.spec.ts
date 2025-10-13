import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import {
  NotificationDeliveryAttemptEntity,
  NotificationDeliveryAttemptStatus
} from './notification-delivery-attempt.entity';
import { NotificationEntity } from './notification.entity';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ConfigService } from '@nestjs/config';
import { NotificationEventsService } from './notification-events.service';
import { ConflictException } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Repository } from 'typeorm';

describe('NotificationsService', () => {
  let module: TestingModule;
  let service: NotificationsService;
  let notificationsRepository: Repository<NotificationEntity>;
  let attemptsRepository: Repository<NotificationDeliveryAttemptEntity>;
  let amqpPublish: jest.Mock;
  let redisPublish: jest.Mock;
  let eventsHandler: jest.Mock;

  beforeEach(async () => {
    amqpPublish = jest.fn().mockResolvedValue(undefined);
    redisPublish = jest.fn().mockResolvedValue(1);
    eventsHandler = jest.fn().mockResolvedValue(undefined);

    const redisServiceMock = {
      getOrThrow: jest.fn().mockReturnValue({ publish: redisPublish })
    };

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

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          entities: [NotificationEntity, NotificationDeliveryAttemptEntity],
          synchronize: true
        }),
        TypeOrmModule.forFeature([NotificationEntity, NotificationDeliveryAttemptEntity])
      ],
      providers: [
        NotificationsService,
        {
          provide: AmqpConnection,
          useValue: { publish: amqpPublish }
        },
        {
          provide: RedisService,
          useValue: redisServiceMock
        },
        {
          provide: ConfigService,
          useValue: configMock
        },
        {
          provide: NotificationEventsService,
          useValue: { handleIncoming: eventsHandler }
        }
      ]
    }).compile();

    service = module.get(NotificationsService);
    notificationsRepository = module.get(getRepositoryToken(NotificationEntity));
    attemptsRepository = module.get(getRepositoryToken(NotificationDeliveryAttemptEntity));
  });

  afterEach(async () => {
    await module.close();
  });

  const createDto = (): CreateNotificationDto => ({
    eventKey: 'deal.status.changed',
    recipients: [
      {
        userId: 'user-1',
        telegramId: '123'
      }
    ],
    payload: { dealId: 'deal-1', status: 'won' },
    channelOverrides: ['telegram'],
    deduplicationKey: 'deal-1:won'
  });

  it('persists notification, publishes to integrations and records attempts', async () => {
    const dto = createDto();

    const result = await service.create(dto);

    expect(result.status).toBe('processing');
    expect(amqpPublish).toHaveBeenCalledWith(
      'notifications.exchange',
      'notifications.created',
      expect.objectContaining({
        notificationId: result.id,
        eventKey: dto.eventKey
      }),
      { persistent: true }
    );
    expect(redisPublish).toHaveBeenCalledWith(
      'notifications:events',
      expect.stringContaining(result.id)
    );
    expect(eventsHandler).toHaveBeenCalledTimes(1);

    const attempts = await attemptsRepository.find({
      where: { notification: { id: result.id } },
      relations: ['notification']
    });

    expect(attempts).toHaveLength(6);
    expect(
      attempts.filter((attempt) => attempt.status === NotificationDeliveryAttemptStatus.Failed)
    ).toHaveLength(0);
  });

  it('throws conflict exception when deduplication key already exists', async () => {
    const dto = createDto();

    await service.create(dto);

    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);

    const notifications = await notificationsRepository.find();
    expect(notifications).toHaveLength(1);
  });
});
