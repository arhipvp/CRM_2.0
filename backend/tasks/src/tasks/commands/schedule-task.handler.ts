import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleTaskCommand } from './schedule-task.command';
import { TaskEntity } from '../entities/task.entity';
import { TaskStatusCode } from '../constants/task-status.constants';
import { TaskEventsPublisher } from '../services/task-events.publisher';
import { DelayedTaskQueueService } from '../../delayed/delayed-task-queue.service';
import { TaskNotFoundException } from '../exceptions/task-not-found.exception';

@CommandHandler(ScheduleTaskCommand)
export class ScheduleTaskHandler implements ICommandHandler<ScheduleTaskCommand, TaskEntity> {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    private readonly eventsPublisher: TaskEventsPublisher,
    private readonly delayedQueue: DelayedTaskQueueService
  ) {}

  async execute(command: ScheduleTaskCommand): Promise<TaskEntity> {
    const task = await this.taskRepository.findOneBy({ id: command.taskId });
    if (!task) {
      throw new TaskNotFoundException(`Task ${command.taskId} not found`);
    }

    const previousStatus = task.statusCode;

    task.scheduledFor = command.scheduledFor;
    task.statusCode = TaskStatusCode.SCHEDULED;
    if (command.title) {
      task.title = command.title;
    }
    if (command.description !== undefined) {
      task.description = command.description;
    }

    await this.delayedQueue.schedule(task.id, command.scheduledFor);
    const saved = await this.taskRepository.save(task);

    if (previousStatus !== saved.statusCode) {
      await this.eventsPublisher.taskStatusChanged(saved, previousStatus);
    }
    return (await this.taskRepository.findOne({ where: { id: saved.id }, relations: ['status'] }))!;
  }
}
