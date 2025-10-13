/// <reference types="jest" />

import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { DataType, newDb } from 'pg-mem';
import { TaskQueryService } from './task-query.service';
import { TaskEntity } from '../entities/task.entity';
import { TaskStatusEntity } from '../entities/task-status.entity';
import { TaskStatusCode } from '../constants/task-status.constants';
import { ListTasksDto, TaskPriority } from '../dto/list-tasks.dto';

describe('TaskQueryService', () => {
  let dataSource: DataSource;
  let service: TaskQueryService;
  let taskRepository: Repository<TaskEntity>;
  let statusRepository: Repository<TaskStatusEntity>;

  beforeAll(async () => {
    const db = newDb({ autoCreateForeignKeyIndices: true });
    db.public.none(`CREATE SCHEMA IF NOT EXISTS tasks`);
    db.public.registerFunction({ name: 'version', returns: DataType.text, implementation: () => 'PostgreSQL 14.0' });
    db.public.registerFunction({ name: 'current_database', returns: DataType.text, implementation: () => 'tasks' });
    db.public.registerFunction({ name: 'uuid_generate_v4', returns: DataType.uuid, implementation: () => randomUUID() });

    dataSource = await db.adapters.createTypeormDataSource({
      type: 'postgres',
      entities: [TaskEntity, TaskStatusEntity],
      synchronize: true
    });
    await dataSource.initialize();

    taskRepository = dataSource.getRepository(TaskEntity);
    statusRepository = dataSource.getRepository(TaskStatusEntity);
    service = new TaskQueryService(taskRepository);

    await statusRepository.save([
      statusRepository.create({
        code: TaskStatusCode.PENDING,
        name: 'Pending',
        description: '',
        isFinal: false
      }),
      statusRepository.create({
        code: TaskStatusCode.COMPLETED,
        name: 'Completed',
        description: '',
        isFinal: true
      })
    ]);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  const seedTasks = async () => {
    await taskRepository.clear();

    const tasks: Array<Partial<TaskEntity>> = [
      {
        id: randomUUID(),
        title: 'Call customer',
        description: 'Clarify requirements',
        statusCode: TaskStatusCode.PENDING,
        dueAt: new Date('2024-03-01T09:00:00.000Z'),
        payload: { assigneeId: 'user-1', priority: TaskPriority.HIGH }
      },
      {
        id: randomUUID(),
        title: 'Archive documents',
        description: 'Send paperwork to storage',
        statusCode: TaskStatusCode.COMPLETED,
        dueAt: new Date('2024-03-05T12:00:00.000Z'),
        payload: { assigneeId: 'user-2', priority: TaskPriority.LOW }
      },
      {
        id: randomUUID(),
        title: 'Prepare summary',
        description: 'Collect weekly updates',
        statusCode: TaskStatusCode.PENDING,
        dueAt: new Date('2024-03-03T10:00:00.000Z'),
        payload: { assigneeId: 'user-1', priority: TaskPriority.NORMAL }
      },
      {
        id: randomUUID(),
        title: 'Schedule follow-up',
        description: 'Plan client call',
        statusCode: TaskStatusCode.PENDING,
        dueAt: new Date('2024-03-04T15:00:00.000Z'),
        payload: { assigneeId: 'user-3', priority: TaskPriority.HIGH }
      }
    ];

    for (const task of tasks) {
      await taskRepository.save(taskRepository.create(task));
    }
  };

  beforeEach(async () => {
    await seedTasks();
  });

  it('filters tasks by assignee id', async () => {
    const dto: ListTasksDto = { assigneeId: 'user-1' };

    const result = await service.findAll(dto);

    expect(result).toHaveLength(2);
    expect(
      result.every((task) => {
        const payload = task.payload as { assigneeId?: string } | null;
        return payload?.assigneeId === 'user-1';
      })
    ).toBe(true);
  });

  it('filters by status, priority and due date range', async () => {
    const dto: ListTasksDto = {
      status: [TaskStatusCode.PENDING],
      priority: [TaskPriority.HIGH],
      dueAfter: '2024-03-03T00:00:00.000Z',
      dueBefore: '2024-03-05T00:00:00.000Z'
    };

    const result = await service.findAll(dto);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Schedule follow-up');
  });

  it('applies pagination with default sorting by due date', async () => {
    const dto: ListTasksDto = { limit: 2, offset: 1 };

    const result = await service.findAll(dto);

    expect(result).toHaveLength(2);
    expect(result.map((task) => task.title)).toEqual(['Prepare summary', 'Schedule follow-up']);
  });
});
