import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity } from '../entities/task.entity';
import { TaskStatusEntity } from '../entities/task-status.entity';
import { CreateTaskCommand } from './create-task.command';
import { TaskEventsPublisher } from '../services/task-events.publisher';
import { TaskStatusCode } from '../constants/task-status.constants';
import { DelayedTaskQueueService } from '../../delayed/delayed-task-queue.service';

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand, TaskEntity> {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(TaskStatusEntity)
    private readonly statusRepository: Repository<TaskStatusEntity>,
    private readonly eventsPublisher: TaskEventsPublisher,
    private readonly delayedQueue: DelayedTaskQueueService
  ) {}

  async execute(command: CreateTaskCommand): Promise<TaskEntity> {
    const status = await this.statusRepository.findOneBy({ code: command.initialStatus });
    if (!status) {
      throw new BadRequestException(`Unknown task status: ${command.initialStatus}`);
    }

    const payload: Record<string, unknown> = { ...(command.payload ?? {}) };

    payload.assigneeId = command.assigneeId;
    payload['assignee_id'] = command.assigneeId;
    payload.authorId = command.authorId;
    payload['author_id'] = command.authorId;

    if (command.priority) {
      payload.priority = command.priority;
    }

    if (command.context) {
      payload.context = command.context;
    }

    const task = this.taskRepository.create({
      title: command.title,
      description: command.description,
      dueAt: command.dueAt,
      scheduledFor: command.scheduledFor,
      payload,
      statusCode: command.initialStatus
    });

    const saved = await this.taskRepository.save(task);

    if (command.initialStatus === TaskStatusCode.SCHEDULED && command.scheduledFor) {
      await this.delayedQueue.schedule(saved.id, command.scheduledFor);
    }

    await this.eventsPublisher.taskCreated(saved);

    return (await this.taskRepository.findOne({ where: { id: saved.id }, relations: ['status'] }))!;
  }
}
