import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity } from '../entities/task.entity';
import { TaskStatusCode } from '../constants/task-status.constants';
import { UpdateTaskCommand } from '../commands/update-task.command';
import { TaskEventsPublisher } from './task-events.publisher';
import { DelayedTaskQueueService } from '../../delayed/delayed-task-queue.service';
import { TaskNotFoundException } from '../exceptions/task-not-found.exception';

const FINAL_STATUSES = new Set<TaskStatusCode>([
  TaskStatusCode.COMPLETED,
  TaskStatusCode.CANCELLED
]);

const invalidStatusTransition = (
  current: TaskStatusCode,
  next: TaskStatusCode,
  message: string
) =>
  new ConflictException({
    statusCode: 409,
    code: 'invalid_status_transition',
    message,
    details: {
      current,
      next
    }
  });

const ALLOWED_TRANSITIONS: Record<TaskStatusCode, TaskStatusCode[]> = {
  [TaskStatusCode.PENDING]: [
    TaskStatusCode.IN_PROGRESS,
    TaskStatusCode.COMPLETED,
    TaskStatusCode.CANCELLED
  ],
  [TaskStatusCode.SCHEDULED]: [
    TaskStatusCode.PENDING,
    TaskStatusCode.IN_PROGRESS,
    TaskStatusCode.CANCELLED
  ],
  [TaskStatusCode.IN_PROGRESS]: [TaskStatusCode.COMPLETED, TaskStatusCode.CANCELLED],
  [TaskStatusCode.COMPLETED]: [],
  [TaskStatusCode.CANCELLED]: []
};

@Injectable()
export class TaskUpdateService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    private readonly eventsPublisher: TaskEventsPublisher,
    private readonly delayedQueue: DelayedTaskQueueService
  ) {}

  async updateTask(command: UpdateTaskCommand): Promise<TaskEntity> {
    const task = await this.taskRepository.findOne({ where: { id: command.taskId } });
    if (!task) {
      throw new TaskNotFoundException(`Task ${command.taskId} not found`);
    }

    const previousStatus = task.statusCode;
    const nextStatus = command.status ?? task.statusCode;
    const statusChanged = previousStatus !== nextStatus;

    if (command.status && command.status !== previousStatus) {
      this.ensureTransition(previousStatus, command.status);
    }

    if (command.completedAt && nextStatus !== TaskStatusCode.COMPLETED) {
      throw new ConflictException('completedAt can only be set for completed tasks');
    }

    if (command.status === TaskStatusCode.COMPLETED && command.completedAt === null) {
      throw new ConflictException('completedAt cannot be null when completing a task');
    }

    if (
      command.cancelledReason !== undefined &&
      nextStatus !== TaskStatusCode.CANCELLED
    ) {
      throw new ConflictException(
        'cancelledReason can only be modified for cancelled tasks'
      );
    }

    if (nextStatus === TaskStatusCode.CANCELLED) {
      const reason = command.cancelledReason ?? task.cancelledReason ?? undefined;
      if (!reason || reason.trim().length === 0) {
        throw new ConflictException('cancelledReason is required when cancelling a task');
      }
    }

    if (
      !command.status &&
      FINAL_STATUSES.has(task.statusCode) &&
      command.cancelledReason === undefined &&
      command.dueAt === undefined &&
      command.completedAt === undefined
    ) {
      return (await this.taskRepository.findOne({ where: { id: task.id }, relations: ['status'] }))!;
    }

    if (command.dueAt !== undefined) {
      task.dueAt = command.dueAt;
    }

    if (command.completedAt !== undefined) {
      task.completedAt = command.completedAt;
    }

    if (command.status === TaskStatusCode.CANCELLED) {
      task.cancelledReason = command.cancelledReason ?? task.cancelledReason ?? null;
      task.scheduledFor = null;
    } else if (command.cancelledReason !== undefined) {
      task.cancelledReason = command.cancelledReason;
    } else if (command.status) {
      task.cancelledReason = null;
    }

    if (command.status && command.status !== previousStatus) {
      task.statusCode = command.status;
      if (previousStatus === TaskStatusCode.SCHEDULED) {
        task.scheduledFor = null;
      }
    }

    const shouldRemoveFromQueue =
      (previousStatus === TaskStatusCode.SCHEDULED && nextStatus !== TaskStatusCode.SCHEDULED) ||
      nextStatus === TaskStatusCode.CANCELLED ||
      nextStatus === TaskStatusCode.COMPLETED;

    if (nextStatus === TaskStatusCode.COMPLETED && task.completedAt == null) {
      task.completedAt = new Date();
    }

    const saved = await this.taskRepository.save(task);

    if (shouldRemoveFromQueue) {
      await this.delayedQueue.remove(saved.id);
    }

    if (statusChanged) {
      await this.eventsPublisher.taskStatusChanged(saved, previousStatus);
    }

    return (await this.taskRepository.findOne({ where: { id: saved.id }, relations: ['status'] }))!;
  }

  private ensureTransition(current: TaskStatusCode, next: TaskStatusCode) {
    if (FINAL_STATUSES.has(current)) {
      throw invalidStatusTransition(
        current,
        next,
        `Task in status ${current} cannot transition to ${next}`
      );
    }

    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw invalidStatusTransition(current, next, `Transition from ${current} to ${next} is not allowed`);
    }
  }
}
