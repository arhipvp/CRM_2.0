import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
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

    const saved = await this.reminderRepository.save(reminder);
    await this.reminderQueue.schedule(saved.id, saved.remindAt);
    return saved;
  }
}
