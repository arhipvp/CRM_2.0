import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompleteTaskCommand } from './complete-task.command';
import { TaskEntity } from '../entities/task.entity';
import { TaskStatusCode } from '../constants/task-status.constants';
import { TaskEventsPublisher } from '../services/task-events.publisher';
import { DelayedTaskQueueService } from '../../delayed/delayed-task-queue.service';
import { TaskNotFoundException } from '../exceptions/task-not-found.exception';

@CommandHandler(CompleteTaskCommand)
export class CompleteTaskHandler implements ICommandHandler<CompleteTaskCommand, TaskEntity> {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    private readonly eventsPublisher: TaskEventsPublisher,
    private readonly delayedQueue: DelayedTaskQueueService
  ) {}

  async execute(command: CompleteTaskCommand): Promise<TaskEntity> {
    const task = await this.taskRepository.findOneBy({ id: command.taskId });
    if (!task) {
      throw new TaskNotFoundException(`Task ${command.taskId} not found`);
    }

    const previousStatus = task.statusCode;

    task.statusCode = TaskStatusCode.COMPLETED;
    task.completedAt = command.completedAt ?? new Date();

    await this.delayedQueue.remove(task.id);
    const saved = await this.taskRepository.save(task);
    await this.eventsPublisher.taskStatusChanged(saved, previousStatus);
    return (await this.taskRepository.findOne({ where: { id: saved.id }, relations: ['status'] }))!;
  }
}
