import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import request from 'supertest';
import { TasksController } from './tasks.controller';
import { TaskQueryService } from '../services/task-query.service';
import { CreateTaskCommand } from '../commands/create-task.command';
import { TaskStatusCode } from '../constants/task-status.constants';
import { TaskEntity } from '../entities/task.entity';
import { TaskStatusEntity } from '../entities/task-status.entity';
import { CreateTaskReminderCommand } from '../commands/create-task-reminder.command';
import { TaskReminderChannel } from '../constants/task-reminder-channel.constants';
import { TaskReminderEntity } from '../entities/task-reminder.entity';

describe('TasksController (validation)', () => {
  let app: INestApplication;
  let commandBus: { execute: jest.Mock };
  let taskQuery: { findById: jest.Mock; findAll: jest.Mock };
  const baseUrl = '/api/tasks';

  beforeEach(async () => {
    commandBus = { execute: jest.fn() };
    taskQuery = { findById: jest.fn(), findAll: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: TaskQueryService, useValue: taskQuery }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true }
      })
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/tasks/invalid возвращает 400 при невалидном UUID', async () => {
    await request(app.getHttpServer()).get(`${baseUrl}/invalid`).expect(400);
    expect(taskQuery.findById).not.toHaveBeenCalled();
  });

  it('GET /api/tasks/:id возвращает 404 с кодом task_not_found, если задача отсутствует', async () => {
    const taskId = '2dc7ea49-2a4e-4f8e-bd3b-7de1fbd2b6a4';
    taskQuery.findById.mockResolvedValue(null);

    const response = await request(app.getHttpServer()).get(`${baseUrl}/${taskId}`).expect(404);

    expect(taskQuery.findById).toHaveBeenCalledWith(taskId);
    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'task_not_found',
      message: `Task ${taskId} not found`
    });
  });

  it('POST /api/tasks создаёт задачу по контракту документации', async () => {
    const createdAt = new Date('2024-03-05T11:00:00.000Z');
    const dueAt = new Date('2024-03-10T00:00:00.000Z');
    const assigneeId = '0f7f0cfd-9f17-4f7f-b761-9a9f0b83f613';
    const authorId = '3c352b2e-73d0-4697-9b4b-91d4a7af8d9e';
    const dealId = 'b5c119de-4f53-4dbd-84c0-2fc7c5e7a0c9';
    const clientId = 'bb9b2f4c-015e-4a0d-9b17-2cc65e0ad0ad';
    const status: TaskStatusEntity = {
      code: TaskStatusCode.PENDING,
      name: 'Pending',
      description: null,
      isFinal: false,
      createdAt
    } as TaskStatusEntity;

    const task: TaskEntity = {
      id: 'task-uuid',
      title: 'Подготовить КП',
      description: 'Согласовать условия и отправить клиенту',
      statusCode: TaskStatusCode.PENDING,
      status,
      dueAt,
      scheduledFor: null,
      completedAt: null,
      cancelledReason: null,
      payload: {
        assigneeId,
        authorId,
        priority: 'high',
        dealId,
        clientId,
        context: { deal_id: dealId }
      },
      createdAt,
      updatedAt: createdAt
    } as TaskEntity;

    commandBus.execute.mockResolvedValue(task);

    const response = await request(app.getHttpServer())
      .post(baseUrl)
      .send({
        subject: 'Подготовить КП',
        description: 'Согласовать условия и отправить клиенту',
        assignee_id: assigneeId,
        author_id: authorId,
        due_date: '2024-03-10',
        priority: 'high',
        context: { deal_id: dealId }
      });

    expect(response.status).toBe(201);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const command = commandBus.execute.mock.calls[0][0] as CreateTaskCommand;
    expect(command).toBeInstanceOf(CreateTaskCommand);
    expect(command.title).toBe('Подготовить КП');
    expect(command.assigneeId).toBe(assigneeId);
    expect(command.authorId).toBe(authorId);
    expect(command.priority).toBe('high');
    expect(command.context).toEqual({ deal_id: dealId });

    expect(response.body).toEqual({
      id: 'task-uuid',
      title: 'Подготовить КП',
      description: 'Согласовать условия и отправить клиенту',
      statusCode: 'pending',
      statusName: 'Pending',
      dueAt: '2024-03-10T00:00:00.000Z',
      scheduledFor: null,
      completedAt: null,
      cancelledReason: null,
      createdAt: '2024-03-05T11:00:00.000Z',
      updatedAt: '2024-03-05T11:00:00.000Z',
      payload: {
        assigneeId,
        authorId,
        priority: 'high',
        dealId,
        clientId,
        context: { deal_id: dealId }
      },
      assigneeId,
      priority: 'high',
      dealId,
      clientId,
      context: { dealId }
    });
  });

  it('POST /api/tasks возвращает 400, если не указано обязательное описание', async () => {
    const assigneeId = '0f7f0cfd-9f17-4f7f-b761-9a9f0b83f613';
    const authorId = '3c352b2e-73d0-4697-9b4b-91d4a7af8d9e';

    const response = await request(app.getHttpServer())
      .post(baseUrl)
      .send({
        subject: 'Подготовить КП',
        assignee_id: assigneeId,
        author_id: authorId
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      message: expect.arrayContaining([expect.stringContaining('description')])
    });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('POST /api/tasks/:id/schedule возвращает 400 при невалидном UUID', async () => {
    await request(app.getHttpServer())
      .post(`${baseUrl}/invalid/schedule`)
      .send({ scheduledFor: new Date().toISOString() })
      .expect(400);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('POST /api/tasks/:id/complete возвращает 400 при невалидном UUID', async () => {
    await request(app.getHttpServer()).post(`${baseUrl}/invalid/complete`).send({}).expect(400);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('PATCH /api/tasks/:id возвращает 400 при невалидном UUID', async () => {
    await request(app.getHttpServer()).patch(`${baseUrl}/invalid`).send({}).expect(400);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('POST /api/tasks/:id/reminders создаёт напоминание и возвращает 201', async () => {
    const taskId = '2dc7ea49-2a4e-4f8e-bd3b-7de1fbd2b6a4';
    const remindAtIso = '2024-03-10T09:00:00.000Z';
    const remindAt = new Date(remindAtIso);

    const reminder: TaskReminderEntity = {
      id: 'e63c24c8-6e15-4b07-9a6c-4a9247dc1449',
      taskId,
      remindAt,
      channel: TaskReminderChannel.SSE,
      createdAt: new Date('2024-03-09T09:00:00.000Z')
    } as TaskReminderEntity;

    commandBus.execute.mockResolvedValue(reminder);

    const response = await request(app.getHttpServer())
      .post(`${baseUrl}/${taskId}/reminders`)
      .send({ remind_at: remindAtIso, channel: 'sse' })
      .expect(201);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const command = commandBus.execute.mock.calls[0][0] as CreateTaskReminderCommand;
    expect(command).toBeInstanceOf(CreateTaskReminderCommand);
    expect(command.taskId).toBe(taskId);
    expect(command.remindAt).toEqual(remindAt);
    expect(command.channel).toBe(TaskReminderChannel.SSE);

    expect(response.body).toEqual({
      id: reminder.id,
      taskId,
      remindAt: remindAtIso,
      channel: 'sse',
      createdAt: reminder.createdAt.toISOString()
    });
  });

  it('POST /api/tasks/:id/reminders возвращает 400 при отсутствии remind_at', async () => {
    const taskId = '2dc7ea49-2a4e-4f8e-bd3b-7de1fbd2b6a4';

    const response = await request(app.getHttpServer())
      .post(`${baseUrl}/${taskId}/reminders`)
      .send({})
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      message: expect.arrayContaining([expect.stringContaining('remindAt')])
    });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('POST /api/tasks/:id/reminders возвращает 409 при попытке создать дубликат', async () => {
    const taskId = '2dc7ea49-2a4e-4f8e-bd3b-7de1fbd2b6a4';
    const remindAtIso = '2024-03-10T09:00:00.000Z';

    commandBus.execute.mockRejectedValue(
      new ConflictException({ statusCode: 409, code: 'conflict', message: 'duplicate reminder' })
    );

    const response = await request(app.getHttpServer())
      .post(`${baseUrl}/${taskId}/reminders`)
      .send({ remind_at: remindAtIso, channel: 'sse' })
      .expect(409);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      statusCode: 409,
      code: 'conflict'
    });
  });
});
