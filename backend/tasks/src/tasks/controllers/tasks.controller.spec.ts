import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import request from 'supertest';
import { TasksController } from './tasks.controller';
import { TaskQueryService } from '../services/task-query.service';

describe('TasksController (validation)', () => {
  let app: INestApplication;
  let commandBus: { execute: jest.Mock };
  let taskQuery: { findById: jest.Mock; findAll: jest.Mock };

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
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /tasks/:id возвращает 400 при невалидном UUID', async () => {
    await request(app.getHttpServer()).get('/tasks/invalid').expect(400);
    expect(taskQuery.findById).not.toHaveBeenCalled();
  });

  it('POST /tasks/:id/schedule возвращает 400 при невалидном UUID', async () => {
    await request(app.getHttpServer())
      .post('/tasks/invalid/schedule')
      .send({ scheduledFor: new Date().toISOString() })
      .expect(400);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('POST /tasks/:id/complete возвращает 400 при невалидном UUID', async () => {
    await request(app.getHttpServer()).post('/tasks/invalid/complete').send({}).expect(400);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('PATCH /tasks/:id возвращает 400 при невалидном UUID', async () => {
    await request(app.getHttpServer()).patch('/tasks/invalid').send({}).expect(400);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
