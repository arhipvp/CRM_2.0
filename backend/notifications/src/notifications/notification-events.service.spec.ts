import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import {
  NotificationEventEntity,
  NotificationStatus
} from './notification-event.entity';
import { NotificationEventsService } from './notification-events.service';
import { NotificationStreamService } from './notification-stream.service';
import { TelegramService } from './telegram.service';
import { IncomingNotificationDto } from './dto/incoming-notification.dto';

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

  async find(): Promise<NotificationEventEntity[]> {
    return this.items.map((item) => ({ ...item }));
  }

  async findOne({ where: { id } }: { where: { id: string } }): Promise<NotificationEventEntity | null> {
    const item = this.items.find((record) => record.id === id);
    return item ? { ...item } : null;
  }

  async clear(): Promise<void> {
    this.items = [];
  }
}

describe('NotificationEventsService', () => {
  let service: NotificationEventsService;
  let repository: InMemoryNotificationRepository;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
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

    service = moduleRef.get(NotificationEventsService);
    repository = moduleRef.get<InMemoryNotificationRepository>(
      getRepositoryToken(NotificationEventEntity)
    );
  });

  beforeEach(async () => {
    await repository.clear();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('marks notifications as delivered after processing', async () => {
    const dto: IncomingNotificationDto = {
      eventType: 'deal.created',
      payload: { dealId: '123' },
      chatId: '999'
    };

    await service.handleIncoming(dto);

    const stored = await repository.find();
    expect(stored).toHaveLength(1);

    const entity = stored[0];
    expect(entity.status).toBe(NotificationStatus.DELIVERED);
    expect(entity.attempts).toBe(1);
    expect(entity.channels).toEqual(['telegram']);
    expect(entity.deliveredToTelegram).toBe(true);
    expect(entity.deliveredAt).toBeInstanceOf(Date);
  });
});
