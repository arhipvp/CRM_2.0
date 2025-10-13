import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateTaskReminderCommand } from './create-task-reminder.command';
import { TaskEntity } from '../entities/task.entity';
import { TaskReminderEntity } from '../entities/task-reminder.entity';
import { TaskReminderQueueService } from '../services/task-reminder-queue.service';

@CommandHandler(CreateTaskReminderCommand)
export class CreateTaskReminderHandler
  implements ICommandHandler<CreateTaskReminderCommand, TaskReminderEntity>
{
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(TaskReminderEntity)
    private readonly reminderRepository: Repository<TaskReminderEntity>,
    private readonly reminderQueue: TaskReminderQueueService
  ) {}

  async execute(command: CreateTaskReminderCommand): Promise<TaskReminderEntity> {
    const task = await this.taskRepository.findOneBy({ id: command.taskId });
    if (!task) {
      throw new NotFoundException(`Task ${command.taskId} not found`);
    }

    const reminder = this.reminderRepository.create({
      taskId: command.taskId,
      remindAt: command.remindAt,
      channel: command.channel
    });

    try {
      const saved = await this.reminderRepository.save(reminder);
      await this.reminderQueue.schedule(saved.id, saved.remindAt);
      return saved;
    } catch (error) {
      if (this.isUniqueViolationError(error)) {
        throw new ConflictException(
          {
            statusCode: 409,
            code: 'conflict',
            message: 'Task reminder with the same remindAt and channel already exists'
          },
          { cause: error instanceof Error ? error : undefined }
        );
      }

      throw error;
    }
  }

  private isUniqueViolationError(error: unknown): boolean {
    if (!error) {
      return false;
    }

    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string } | undefined;
      if (this.isUniqueViolationCode(driverError?.code)) {
        return true;
      }
    }

    if (error instanceof Error && error.name === 'UniqueViolationError') {
      return true;
    }

    if (typeof error === 'object') {
      const maybeCode = (error as { code?: unknown }).code;
      if (typeof maybeCode === 'string' && this.isUniqueViolationCode(maybeCode)) {
        return true;
      }

      const driverError = (error as { driverError?: { code?: string } }).driverError;
      if (driverError && this.isUniqueViolationCode(driverError.code)) {
        return true;
      }
    }

    return false;
  }

  private isUniqueViolationCode(code?: string): boolean {
    return code === '23505';
  }
}
