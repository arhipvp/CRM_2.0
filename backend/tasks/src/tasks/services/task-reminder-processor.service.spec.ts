/// <reference types="jest" />

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TaskReminderProcessor } from './task-reminder-processor.service';
import { TaskReminderQueueService } from './task-reminder-queue.service';
import { TaskEventsPublisher } from './task-events.publisher';
import { TaskReminderEntity } from '../entities/task-reminder.entity';
import { TaskReminderChannel } from '../constants/task-reminder-channel.constants';

const reminderFactory = (overrides: Partial<TaskReminderEntity> = {}): TaskReminderEntity => ({
  id: 'reminder-id',
  taskId: 'task-id',
  remindAt: new Date('2024-03-10T09:00:00Z'),
  channel: TaskReminderChannel.SSE,
  createdAt: new Date('2024-03-01T00:00:00Z'),
  task: undefined as any,
  ...overrides
});

describe('TaskReminderProcessor', () => {
  let processor: TaskReminderProcessor;
  let queue: jest.Mocked<TaskReminderQueueService>;
  let repository: jest.Mocked<Repository<TaskReminderEntity>>;
  let publisher: jest.Mocked<TaskEventsPublisher>;
  let config: jest.Mocked<ConfigService>;
  let queueEntries: Map<string, number>;

  beforeEach(async () => {
    queueEntries = new Map<string, number>();

    queue = {
      claimDue: jest.fn(async () => {
        const due = Array.from(queueEntries.entries()).map(([id, score]) => ({ id, score }));
        queueEntries.clear();
        return due;
      }),
      schedule: jest.fn(async (id: string, runAt: Date) => {
        queueEntries.set(id, runAt.getTime());
      })
    } as unknown as jest.Mocked<TaskReminderQueueService>;

    repository = {
      findOne: jest.fn()
    } as unknown as jest.Mocked<Repository<TaskReminderEntity>>;

    publisher = {
      taskReminder: jest.fn()
    } as unknown as jest.Mocked<TaskEventsPublisher>;

    config = {
      get: jest.fn()
    } as unknown as jest.Mocked<ConfigService>;

    config.get.mockImplementation((key: string, defaultValue?: unknown) => {
      switch (key) {
        case 'tasks.scheduling.batchSize':
          return 10;
        case 'tasks.reminders.pollIntervalMs':
          return 5000;
        default:
          return defaultValue as unknown;
      }
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        TaskReminderProcessor,
        { provide: TaskReminderQueueService, useValue: queue },
        { provide: TaskEventsPublisher, useValue: publisher },
        { provide: getRepositoryToken(TaskReminderEntity), useValue: repository },
        { provide: ConfigService, useValue: config }
      ]
    }).compile();

    processor = moduleRef.get(TaskReminderProcessor);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('публикует событие, очищает очередь и возвращает количество обработанных напоминаний', async () => {
    const reminder = reminderFactory();
    queueEntries.set(reminder.id, reminder.remindAt.getTime());
    repository.findOne.mockResolvedValue(reminder);

    const processed = await processor.processDueReminders();

    expect(processed).toBe(1);
    expect(publisher.taskReminder).toHaveBeenCalledWith(reminder);
    expect(queue.schedule).not.toHaveBeenCalled();
    expect(queueEntries.size).toBe(0);
  });

  it('пропускает удалённые напоминания', async () => {
    queueEntries.set('missing', Date.now());
    repository.findOne.mockResolvedValue(null);

    const processed = await processor.processDueReminders();

    expect(processed).toBe(0);
    expect(publisher.taskReminder).not.toHaveBeenCalled();
    expect(queue.schedule).not.toHaveBeenCalled();
    expect(queueEntries.size).toBe(0);
  });

  it('повторяет попытку при ошибке и откладывает напоминание', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-03-10T09:00:00Z'));

    const reminder = reminderFactory({ id: 'retry-reminder' });
    queueEntries.set(reminder.id, reminder.remindAt.getTime());
    repository.findOne.mockResolvedValue(reminder);
    publisher.taskReminder.mockRejectedValue(new Error('temporary failure'));

    const processed = await processor.processDueReminders();

    expect(processed).toBe(0);
    expect(queue.schedule).toHaveBeenCalledTimes(1);
    const [retryId, retryDate] = queue.schedule.mock.calls[0];
    expect(retryId).toBe(reminder.id);
    expect(retryDate).toBeInstanceOf(Date);
    expect((retryDate as Date).getTime()).toBeGreaterThanOrEqual(Date.now() + 5000);
    expect(queueEntries.has(reminder.id)).toBe(true);
  });
});
