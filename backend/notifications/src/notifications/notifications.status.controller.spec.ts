import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { randomUUID } from 'crypto';
import {
  NotificationEventEntity,
  NotificationStatus
} from './notification-event.entity';
import { NotificationsStatusController } from './notifications.status.controller';
import { NotificationEventsService } from './notification-events.service';
import { NotificationStreamService } from './notification-stream.service';
import { TelegramService } from './telegram.service';

class InMemoryNotificationRepository {
  private items: NotificationEventEntity[] = [];

  create(data: Partial<NotificationEventEntity>): NotificationEventEntity {
    return {
      id: data.id ?? randomUUID(),
      eventType: data.eventType ?? '',
      payload: data.payload ?? {},
      status: data.status ?? NotificationStatus.PENDING,
      attempts: data.attempts ?? 0,
      channels: data.channels ?? [],
      deliveredToTelegram: data.deliveredToTelegram ?? false,
      deliveredAt: data.deliveredAt ?? null,
      createdAt: data.createdAt ?? new Date()
    };
  }

  async save(entity: NotificationEventEntity): Promise<NotificationEventEntity> {
    const existingIndex = this.items.findIndex((item) => item.id === entity.id);
    const clone = { ...entity };
    if (existingIndex >= 0) {
      this.items[existingIndex] = clone;
    } else {
      this.items.push(clone);
    }
    return { ...clone };
  }

  async update(id: string, partial: Partial<NotificationEventEntity>): Promise<void> {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      return;
    }
    this.items[index] = { ...this.items[index], ...partial };
  }

  async findOne({ where: { id } }: { where: { id: string } }): Promise<NotificationEventEntity | null> {
    const item = this.items.find((record) => record.id === id);
    return item ? { ...item } : null;
  }

  async clear(): Promise<void> {
    this.items = [];
  }
}

describe('NotificationsStatusController (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let repository: InMemoryNotificationRepository;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [NotificationsStatusController],
      providers: [
        NotificationEventsService,
        {
          provide: NotificationStreamService,
          useValue: { publish: jest.fn() }
        },
        {
          provide: TelegramService,
          useValue: { send: jest.fn().mockResolvedValue(true) }
        },
        {
          provide: getRepositoryToken(NotificationEventEntity),
          useClass: InMemoryNotificationRepository
        }
      ]
    }).compile();

    repository = moduleRef.get<InMemoryNotificationRepository>(
      getRepositoryToken(NotificationEventEntity)
    );

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(async () => {
    await repository.clear();
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  it('returns notification status by id', async () => {
    const deliveredAt = new Date('2024-02-18T08:30:00.000Z');
    const entity = repository.create({
      eventType: 'deal.updated',
      payload: { id: 'abc' },
      status: NotificationStatus.DELIVERED,
      attempts: 2,
      channels: ['telegram'],
      deliveredToTelegram: true,
      deliveredAt
    });
    await repository.save(entity);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/notifications/${entity.id}`)
      .expect(200);

    expect(response.body).toEqual({
      id: entity.id,
      status: 'delivered',
      attempts: 2,
      channels: ['telegram'],
      delivered_at: deliveredAt.toISOString()
    });
  });

  it('returns 404 for missing notification', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/notifications/00000000-0000-0000-0000-000000000000')
      .expect(404);

    expect(response.body.error).toBe('notification_not_found');
  });
});
