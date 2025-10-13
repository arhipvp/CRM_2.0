import { TaskEntity } from '../entities/task.entity';

export class TaskResponseDto {
  id!: string;
  title!: string;
  description?: string | null;
  statusCode!: string;
  statusName?: string;
  dueAt?: string | null;
  scheduledFor?: string | null;
  completedAt?: string | null;
  createdAt!: string;
  updatedAt!: string;

  static fromEntity(entity: TaskEntity): TaskResponseDto {
    const dto = new TaskResponseDto();
    dto.id = entity.id;
    dto.title = entity.title;
    dto.description = entity.description ?? null;
    dto.statusCode = entity.statusCode;
    dto.statusName = entity.status?.name;
    dto.dueAt = entity.dueAt?.toISOString() ?? null;
    dto.scheduledFor = entity.scheduledFor?.toISOString() ?? null;
    dto.completedAt = entity.completedAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
