/// <reference types="jest" />

import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { NotificationsService } from './notifications.service';
import { NotificationEntity, NotificationStatus } from './notification.entity';
import {
  NotificationDeliveryAttemptEntity,
  NotificationDeliveryAttemptStatus
} from './notification-delivery-attempt.entity';
import { NotificationsConfiguration } from '../config/configuration';
import { NotificationEventsService } from './notification-events.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryFailedError } from 'typeorm/error/QueryFailedError';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationsRepository: jest.Mocked<Repository<NotificationEntity>>;
  let attemptsRepository: jest.Mocked<Repository<NotificationDeliveryAttemptEntity>>;
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
    (attemptsRepository.create as jest.Mock).mockImplementation(
      (payload) => payload as NotificationDeliveryAttemptEntity
    );
    (attemptsRepository.save as jest.Mock).mockImplementation(
      async (entity) => entity as NotificationDeliveryAttemptEntity
    );

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

  it('marks notification as failed when internal dispatch fails', async () => {
    notificationEventsService.handleIncoming.mockRejectedValue(
      new InternalServerErrorException('notification_dispatch_failed')
    );

    await expect(service.enqueue(dto)).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'notification_dispatch_failed' })
    });

    expect(attemptsRepository.create).toHaveBeenCalledTimes(3);
    const failureAttempt = (attemptsRepository.create as jest.Mock).mock.calls[2][0];
    expect(failureAttempt.channel).toBe('events-service');
    expect(failureAttempt.status).toBe(NotificationDeliveryAttemptStatus.FAILURE);
    expect(failureAttempt.error).toBe('notification_dispatch_failed');

    expect(notificationsRepository.update).toHaveBeenCalledWith('notification-id', {
      status: NotificationStatus.FAILED,
      lastError: 'notification_dispatch_failed'
    });
    const statuses = notificationsRepository.update.mock.calls
      .map(([, payload]) => (payload as Partial<NotificationEntity>).status)
      .filter(Boolean);
    expect(statuses).not.toContain(NotificationStatus.PROCESSED);
  });
});
