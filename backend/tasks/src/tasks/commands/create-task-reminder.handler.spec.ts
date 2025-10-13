import { Repository, QueryFailedError } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import { CreateTaskReminderHandler } from './create-task-reminder.handler';
import { TaskEntity } from '../entities/task.entity';
import { TaskReminderEntity } from '../entities/task-reminder.entity';
import { TaskReminderQueueService } from '../services/task-reminder-queue.service';
import { CreateTaskReminderCommand } from './create-task-reminder.command';
import { TaskReminderChannel } from '../constants/task-reminder-channel.constants';
import { TaskNotFoundException } from '../exceptions/task-not-found.exception';

describe('CreateTaskReminderHandler', () => {
  let handler: CreateTaskReminderHandler;
  let taskRepository: jest.Mocked<Repository<TaskEntity>>;
  let reminderRepository: jest.Mocked<Repository<TaskReminderEntity>>;
  let reminderQueue: { schedule: jest.Mock };

  beforeEach(() => {
    taskRepository = {
      findOneBy: jest.fn()
    } as unknown as jest.Mocked<Repository<TaskEntity>>;

    reminderRepository = {
      create: jest.fn(),
      save: jest.fn()
    } as unknown as jest.Mocked<Repository<TaskReminderEntity>>;

    reminderQueue = { schedule: jest.fn() };

    handler = new CreateTaskReminderHandler(
      taskRepository,
      reminderRepository,
      reminderQueue as unknown as TaskReminderQueueService
    );
  });

  it('создаёт напоминание и планирует его в очереди', async () => {
    const taskId = '56f7adcd-bc6b-4059-9fcb-4fb0f299a022';
    const remindAt = new Date('2024-03-10T12:00:00.000Z');

    taskRepository.findOneBy.mockResolvedValue({ id: taskId } as TaskEntity);

    const savedReminder: TaskReminderEntity = {
      id: '5f4f93f2-1965-4240-9a3d-6fdc54bb693c',
      taskId,
      remindAt,
      channel: TaskReminderChannel.TELEGRAM,
      createdAt: new Date('2024-03-09T12:00:00.000Z')
    } as TaskReminderEntity;

    reminderRepository.create.mockReturnValue(savedReminder);
    reminderRepository.save.mockResolvedValue(savedReminder);

    const command = new CreateTaskReminderCommand(taskId, remindAt, TaskReminderChannel.TELEGRAM);

    const result = await handler.execute(command);

    expect(taskRepository.findOneBy).toHaveBeenCalledWith({ id: taskId });
    expect(reminderRepository.create).toHaveBeenCalledWith({
      taskId,
      remindAt,
      channel: TaskReminderChannel.TELEGRAM
    });
    expect(reminderRepository.save).toHaveBeenCalledWith(savedReminder);
    expect(reminderQueue.schedule).toHaveBeenCalledWith(savedReminder.id, remindAt);
    expect(result).toBe(savedReminder);
  });

  it('бросает TaskNotFoundException, если задача не найдена', async () => {
    taskRepository.findOneBy.mockResolvedValue(null);

    const command = new CreateTaskReminderCommand(
      '56f7adcd-bc6b-4059-9fcb-4fb0f299a022',
      new Date(),
      TaskReminderChannel.SSE
    );

    const execution = handler.execute(command);

    await expect(execution).rejects.toBeInstanceOf(TaskNotFoundException);
    await execution.catch((error) => {
      expect(error).toBeInstanceOf(TaskNotFoundException);
      expect((error as TaskNotFoundException).getResponse()).toMatchObject({ code: 'task_not_found' });
    });
    expect(reminderRepository.create).not.toHaveBeenCalled();
    expect(reminderQueue.schedule).not.toHaveBeenCalled();
  });

  it('бросает ConflictException с кодом conflict при попытке создать дубликат', async () => {
    const taskId = '56f7adcd-bc6b-4059-9fcb-4fb0f299a022';
    const remindAt = new Date('2024-03-10T12:00:00.000Z');

    taskRepository.findOneBy.mockResolvedValue({ id: taskId } as TaskEntity);

    const reminder: TaskReminderEntity = {
      taskId,
      remindAt,
      channel: TaskReminderChannel.SSE
    } as TaskReminderEntity;

    reminderRepository.create.mockReturnValue(reminder);

    const driverError = new Error('duplicate reminder') as Error & { code?: string };
    driverError.code = '23505';
    const uniqueError = new QueryFailedError('', [], driverError);
    reminderRepository.save.mockRejectedValue(uniqueError);

    const command = new CreateTaskReminderCommand(taskId, remindAt, TaskReminderChannel.SSE);

    const execution = handler.execute(command);

    await expect(execution).rejects.toBeInstanceOf(ConflictException);
    await execution.catch((error) => {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({ code: 'conflict' });
    });

    expect(reminderQueue.schedule).not.toHaveBeenCalled();
  });
});
