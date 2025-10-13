import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivateScheduledTaskCommand } from './activate-scheduled-task.command';
import { TaskEntity } from '../entities/task.entity';
import { TaskStatusCode } from '../constants/task-status.constants';
import { TaskEventsPublisher } from '../services/task-events.publisher';
import { TaskNotFoundException } from '../exceptions/task-not-found.exception';

@CommandHandler(ActivateScheduledTaskCommand)
export class ActivateScheduledTaskHandler
  implements ICommandHandler<ActivateScheduledTaskCommand, TaskEntity>
{
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    private readonly eventsPublisher: TaskEventsPublisher
  ) {}

  async execute(command: ActivateScheduledTaskCommand): Promise<TaskEntity> {
    const task = await this.taskRepository.findOneBy({ id: command.taskId });
    if (!task) {
      throw new TaskNotFoundException(`Task ${command.taskId} not found`);
    }

    task.statusCode = TaskStatusCode.PENDING;
    task.scheduledFor = null;

    const saved = await this.taskRepository.save(task);
    await this.eventsPublisher.taskReady(saved);
    return (await this.taskRepository.findOne({ where: { id: saved.id }, relations: ['status'] }))!;
  }
}
