import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreateTaskHandler } from './create-task.handler';
import { TaskEntity } from '../entities/task.entity';
import { TaskStatusEntity } from '../entities/task-status.entity';
import { TaskEventsPublisher } from '../services/task-events.publisher';
import { DelayedTaskQueueService } from '../../delayed/delayed-task-queue.service';
import { TaskStatusCode } from '../constants/task-status.constants';
import { CreateTaskCommand } from './create-task.command';

describe('CreateTaskHandler', () => {
  let handler: CreateTaskHandler;
  let taskRepository: jest.Mocked<Repository<TaskEntity>>;
  let statusRepository: jest.Mocked<Repository<TaskStatusEntity>>;
  let eventsPublisher: { taskCreated: jest.Mock };
  let delayedQueue: { schedule: jest.Mock };

  beforeEach(() => {
    taskRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn()
    } as unknown as jest.Mocked<Repository<TaskEntity>>;

    statusRepository = {
      findOneBy: jest.fn()
    } as unknown as jest.Mocked<Repository<TaskStatusEntity>>;

    eventsPublisher = { taskCreated: jest.fn() };
    delayedQueue = { schedule: jest.fn() };

    handler = new CreateTaskHandler(
      taskRepository,
      statusRepository,
      eventsPublisher as unknown as TaskEventsPublisher,
      delayedQueue as unknown as DelayedTaskQueueService
    );
  });

  it('normalizes context and mirrors dealId/clientId in payload', async () => {
    const status: TaskStatusEntity = {
      code: TaskStatusCode.PENDING
    } as TaskStatusEntity;

    statusRepository.findOneBy.mockResolvedValue(status);

    let createdPayload: Record<string, unknown> | undefined;

    taskRepository.create.mockImplementation((data) => {
      createdPayload = (data.payload ?? undefined) as Record<string, unknown> | undefined;
      return { id: 'task-id', ...data } as TaskEntity;
    });

    taskRepository.save.mockResolvedValue({ id: 'task-id' } as TaskEntity);

    taskRepository.findOne.mockImplementation(async () => ({
      id: 'task-id',
      status,
      payload: createdPayload ?? null
    }) as TaskEntity);

    const command = new CreateTaskCommand(
      'Follow up',
      undefined,
      undefined,
      undefined,
      undefined,
      TaskStatusCode.PENDING,
      'assignee-1',
      'author-1',
      undefined,
      {
        deal_id: 'deal-1',
        clientId: 'client-2',
        policy_id: 'policy-3'
      }
    );

    const result = await handler.execute(command);

    expect(taskRepository.create).toHaveBeenCalledTimes(1);

    const payload = taskRepository.create.mock.calls[0][0].payload as Record<
      string,
      unknown
    >;

    expect(payload.dealId).toBe('deal-1');
    expect(payload['deal_id']).toBe('deal-1');
    expect(payload.clientId).toBe('client-2');
    expect(payload['client_id']).toBe('client-2');
    expect(payload.context).toEqual({
      dealId: 'deal-1',
      clientId: 'client-2',
      policyId: 'policy-3'
    });

    expect(result.payload).toEqual(payload);
  });

  it('throws if status is unknown', async () => {
    statusRepository.findOneBy.mockResolvedValue(null);

    const command = new CreateTaskCommand(
      'Follow up',
      undefined,
      undefined,
      undefined,
      undefined,
      TaskStatusCode.PENDING,
      'assignee-1',
      'author-1',
      undefined,
      undefined
    );

    await expect(handler.execute(command)).rejects.toBeInstanceOf(BadRequestException);
  });
});
