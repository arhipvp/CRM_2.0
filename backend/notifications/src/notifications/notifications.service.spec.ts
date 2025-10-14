/// <reference types="jest" />

import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { NotificationsService } from './notifications.service';
import { NotificationEntity, NotificationStatus } from './notification.entity';
import { NotificationDeliveryAttemptEntity } from './notification-delivery-attempt.entity';
import { NotificationEventEntity } from './notification-event.entity';
import { NotificationsConfiguration } from '../config/configuration';
import { NotificationEventsService } from './notification-events.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryFailedError } from 'typeorm/error/QueryFailedError';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationsRepository: jest.Mocked<Repository<NotificationEntity>>;
  let attemptsRepository: jest.Mocked<Repository<NotificationDeliveryAttemptEntity>>;
  let eventsRepository: jest.Mocked<Repository<NotificationEventEntity>>;
  let amqpConnection: { publish: jest.Mock };
  let redisClient: { publish: jest.Mock };
  let notificationEventsService: { handleIncoming: jest.Mock };
  let configService: jest.Mocked<ConfigService<NotificationsConfiguration>>;

  const dto: CreateNotificationDto = {
    eventKey: 'deal.created',
    recipients: [{ userId: 'user-1', telegramId: '1000' }],
    payload: { id: 'deal-id' },
    channelOverrides: ['telegram'],
    deduplicationKey: 'deal:deal-id'
  };

  beforeEach(async () => {
    notificationsRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findOneByOrFail: jest.fn()
    } as unknown as jest.Mocked<Repository<NotificationEntity>>;

    attemptsRepository = {
      create: jest.fn(),
      save: jest.fn()
    } as unknown as jest.Mocked<Repository<NotificationDeliveryAttemptEntity>>;

    eventsRepository = {
      find: jest.fn()
    } as unknown as jest.Mocked<Repository<NotificationEventEntity>>;

    amqpConnection = { publish: jest.fn().mockResolvedValue(undefined) };
    redisClient = { publish: jest.fn().mockResolvedValue(1) };

    const redisService = {
      getOrThrow: jest.fn().mockReturnValue(redisClient)
    } as unknown as jest.Mocked<RedisService>;

    notificationEventsService = {
      handleIncoming: jest.fn().mockResolvedValue(undefined)
    };

    configService = {
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
    } as unknown as jest.Mocked<ConfigService<NotificationsConfiguration>>;

    const createdNotification: NotificationEntity = {
      id: 'notification-id',
      eventKey: dto.eventKey,
      recipients: dto.recipients,
      payload: dto.payload,
      channelOverrides: dto.channelOverrides ?? null,
      deduplicationKey: dto.deduplicationKey ?? null,
      status: NotificationStatus.PENDING,
      attemptsCount: 0,
      lastAttemptAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: []
    };

    notificationsRepository.create.mockReturnValue(createdNotification);
    notificationsRepository.save.mockResolvedValue(createdNotification);
    notificationsRepository.findOneByOrFail.mockResolvedValue(createdNotification);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(NotificationEntity), useValue: notificationsRepository },
        {
          provide: getRepositoryToken(NotificationDeliveryAttemptEntity),
          useValue: attemptsRepository
        },
        { provide: getRepositoryToken(NotificationEventEntity), useValue: eventsRepository },
        { provide: NotificationEventsService, useValue: notificationEventsService },
        { provide: AmqpConnection, useValue: amqpConnection },
        { provide: RedisService, useValue: redisService },
        { provide: ConfigService, useValue: configService }
      ]
    }).compile();

    service = module.get(NotificationsService);
  });

  it('creates notification and dispatches it to integrations', async () => {
    const result = await service.enqueue(dto);

    expect(result.id).toBe('notification-id');
    expect(amqpConnection.publish).toHaveBeenCalledWith(
      'notifications.exchange',
      'notifications.dispatch',
      expect.objectContaining({ notificationId: 'notification-id' }),
      expect.objectContaining({ persistent: true })
    );
    expect(redisClient.publish).toHaveBeenCalledWith(
      'notifications:dispatch',
      expect.stringContaining('notification-id')
    );
    expect(notificationEventsService.handleIncoming).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: dto.eventKey })
    );
    expect(attemptsRepository.save).toHaveBeenCalledTimes(3);
    expect(notificationsRepository.update).toHaveBeenCalledWith('notification-id', {
      status: NotificationStatus.PROCESSED
    });
  });

  it('throws conflict when notification with deduplication key exists', async () => {
    notificationsRepository.findOne.mockResolvedValue({
      id: 'existing-id'
    } as NotificationEntity);

    await expect(service.enqueue(dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws conflict when database unique constraint is triggered', async () => {
    notificationsRepository.findOne.mockResolvedValue(null as unknown as NotificationEntity);
    const queryError = new QueryFailedError('INSERT', [], new Error('duplicate'));
    (queryError as unknown as { code: string }).code = '23505';
    notificationsRepository.save.mockRejectedValue(queryError);

    await expect(service.enqueue(dto)).rejects.toBeInstanceOf(ConflictException);
  });
});
