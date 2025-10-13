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

const toCamelCase = (key: string): string =>
  key
    .replace(/^[A-Z]/, (char) => char.toLowerCase())
    .replace(/[-_]+(\w)/g, (_, char: string) => char.toUpperCase());

const normalizeContextKeys = (
  context: Record<string, unknown>
): Record<string, unknown> =>
  Object.entries(context).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[toCamelCase(key)] = value;
    return acc;
  }, {});

const extractIdentifier = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

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
      const context = command.context;
      const dealId = extractIdentifier(context['dealId'] ?? context['deal_id']);
      const clientId = extractIdentifier(context['clientId'] ?? context['client_id']);
      const normalizedContext = normalizeContextKeys(context);

      if (dealId) {
        payload.dealId = dealId;
        payload['deal_id'] = dealId;
        normalizedContext.dealId = dealId;
      }

      if (clientId) {
        payload.clientId = clientId;
        payload['client_id'] = clientId;
        normalizedContext.clientId = clientId;
      }

      payload.context = normalizedContext;
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
