/// <reference types="jest" />

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TaskUpdateService } from './task-update.service';
import { TaskEntity } from '../entities/task.entity';
import { TaskStatusCode } from '../constants/task-status.constants';
import { TaskEventsPublisher } from './task-events.publisher';
import { DelayedTaskQueueService } from '../../delayed/delayed-task-queue.service';
import { UpdateTaskCommand } from '../commands/update-task.command';

describe('TaskUpdateService', () => {
  let service: TaskUpdateService;
  let repository: jest.Mocked<Repository<TaskEntity>>;
  let eventsPublisher: { taskCompleted: jest.Mock };
  let delayedQueue: { remove: jest.Mock };

  beforeEach(async () => {
    eventsPublisher = { taskCompleted: jest.fn() };
    delayedQueue = { remove: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TaskUpdateService,
        {
          provide: getRepositoryToken(TaskEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn()
          }
        },
        { provide: TaskEventsPublisher, useValue: eventsPublisher },
        { provide: DelayedTaskQueueService, useValue: delayedQueue }
      ]
    }).compile();

    service = moduleRef.get(TaskUpdateService);
    repository = moduleRef.get(getRepositoryToken(TaskEntity));
    repository.save.mockImplementation(async value => value as TaskEntity);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('обновляет статус и dueAt', async () => {
    const task: TaskEntity = {
      id: 'task-1',
      title: 'Test',
      statusCode: TaskStatusCode.PENDING,
      description: null,
      dueAt: null,
      scheduledFor: null,
      payload: null,
      completedAt: null,
      cancelledReason: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      status: undefined as any
    };

    const updated: TaskEntity = {
      ...task,
      statusCode: TaskStatusCode.IN_PROGRESS,
      dueAt: new Date('2024-02-01T00:00:00Z')
    };

    repository.findOne.mockResolvedValueOnce(task);
    repository.findOne.mockResolvedValueOnce(updated);

    const command = new UpdateTaskCommand('task-1', TaskStatusCode.IN_PROGRESS, new Date('2024-02-01T00:00:00Z'));
    const result = await service.updateTask(command);

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: TaskStatusCode.IN_PROGRESS,
        dueAt: new Date('2024-02-01T00:00:00Z')
      })
    );
    expect(result.statusCode).toBe(TaskStatusCode.IN_PROGRESS);
    expect(result.dueAt).toEqual(new Date('2024-02-01T00:00:00Z'));
    expect(delayedQueue.remove).not.toHaveBeenCalled();
  });

  it('выбрасывает исключение при переходе из завершенного статуса', async () => {
    const task: TaskEntity = {
      id: 'task-2',
      title: 'Done',
      statusCode: TaskStatusCode.COMPLETED,
      description: null,
      dueAt: null,
      scheduledFor: null,
      payload: null,
      completedAt: new Date('2024-02-01T00:00:00Z'),
      cancelledReason: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-02-01T00:00:00Z'),
      status: undefined as any
    };

    repository.findOne.mockResolvedValueOnce(task);

    await expect(
      service.updateTask(new UpdateTaskCommand('task-2', TaskStatusCode.PENDING))
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('требует причину отмены при переводе в cancelled', async () => {
    const task: TaskEntity = {
      id: 'task-3',
      title: 'To cancel',
      statusCode: TaskStatusCode.PENDING,
      description: null,
      dueAt: null,
      scheduledFor: null,
      payload: null,
      completedAt: null,
      cancelledReason: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      status: undefined as any
    };

    repository.findOne.mockResolvedValueOnce(task);

    await expect(
      service.updateTask(new UpdateTaskCommand('task-3', TaskStatusCode.CANCELLED))
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('не позволяет изменить причину отмены для активной задачи', async () => {
    const task: TaskEntity = {
      id: 'task-3a',
      title: 'Active task',
      statusCode: TaskStatusCode.PENDING,
      description: null,
      dueAt: null,
      scheduledFor: null,
      payload: null,
      completedAt: null,
      cancelledReason: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
      status: undefined as any
    };

    repository.findOne.mockResolvedValueOnce(task);

    await expect(
      service.updateTask(
        new UpdateTaskCommand('task-3a', undefined, undefined, undefined, 'later')
      )
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('не позволяет обновить причину отмены при возобновлении задачи', async () => {
    const task: TaskEntity = {
      id: 'task-3b',
      title: 'Cancelled task',
      statusCode: TaskStatusCode.CANCELLED,
      description: null,
      dueAt: null,
      scheduledFor: null,
      payload: null,
      completedAt: null,
      cancelledReason: 'initial reason',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
      status: undefined as any
    };

    repository.findOne.mockResolvedValueOnce(task);

    await expect(
      service.updateTask(
        new UpdateTaskCommand(
          'task-3b',
          TaskStatusCode.IN_PROGRESS,
          undefined,
          undefined,
          'updated reason'
        )
      )
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('не позволяет добавить причину отмены при смене на активный статус', async () => {
    const task: TaskEntity = {
      id: 'task-3c',
      title: 'In progress',
      statusCode: TaskStatusCode.PENDING,
      description: null,
      dueAt: null,
      scheduledFor: null,
      payload: null,
      completedAt: null,
      cancelledReason: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
      status: undefined as any
    };

    repository.findOne.mockResolvedValueOnce(task);

    await expect(
      service.updateTask(
        new UpdateTaskCommand(
          'task-3c',
          TaskStatusCode.IN_PROGRESS,
          undefined,
          undefined,
          'late cancellation'
        )
      )
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('отменяет задачу и очищает отложенную очередь', async () => {
    const task: TaskEntity = {
      id: 'task-4',
      title: 'Scheduled',
      statusCode: TaskStatusCode.SCHEDULED,
      description: null,
      dueAt: null,
      scheduledFor: new Date('2024-03-01T10:00:00Z'),
      payload: null,
      completedAt: null,
      cancelledReason: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      status: undefined as any
    };

    const cancelled: TaskEntity = {
      ...task,
      statusCode: TaskStatusCode.CANCELLED,
      cancelledReason: 'not needed',
      scheduledFor: null
    };

    repository.findOne.mockResolvedValueOnce(task);
    repository.findOne.mockResolvedValueOnce(cancelled);

    const command = new UpdateTaskCommand('task-4', TaskStatusCode.CANCELLED, undefined, undefined, 'not needed');
    const result = await service.updateTask(command);

    expect(delayedQueue.remove).toHaveBeenCalledWith('task-4');
    expect(result.statusCode).toBe(TaskStatusCode.CANCELLED);
    expect(result.cancelledReason).toBe('not needed');
  });

  it('устанавливает completedAt по умолчанию при завершении', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-04-01T12:00:00Z'));

    const task: TaskEntity = {
      id: 'task-5',
      title: 'In progress',
      statusCode: TaskStatusCode.IN_PROGRESS,
      description: null,
      dueAt: null,
      scheduledFor: null,
      payload: null,
      completedAt: null,
      cancelledReason: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-03-01T00:00:00Z'),
      status: undefined as any
    };

    const completed: TaskEntity = {
      ...task,
      statusCode: TaskStatusCode.COMPLETED,
      completedAt: new Date('2024-04-01T12:00:00Z')
    };

    repository.findOne.mockResolvedValueOnce(task);
    repository.findOne.mockResolvedValueOnce(completed);

    const result = await service.updateTask(new UpdateTaskCommand('task-5', TaskStatusCode.COMPLETED));

    const savedTask = repository.save.mock.calls[0][0];
    expect(savedTask.completedAt).toEqual(new Date('2024-04-01T12:00:00Z'));
    expect(eventsPublisher.taskCompleted).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-5' }));
    expect(result.statusCode).toBe(TaskStatusCode.COMPLETED);
  });

  it('бросает NotFoundException для несуществующей задачи', async () => {
    repository.findOne.mockResolvedValueOnce(null);

    await expect(service.updateTask(new UpdateTaskCommand('missing'))).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
