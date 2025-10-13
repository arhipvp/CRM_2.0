import { TaskEntity } from '../entities/task.entity';

type NullableString = string | null;

export interface TaskContextResponseDto {
  dealId?: string;
  policyId?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const extractString = (value: unknown): NullableString => {
  return typeof value === 'string' ? value : null;
};

export class TaskResponseDto {
  id!: string;
  title!: string;
  description?: string | null;
  statusCode!: string;
  statusName?: string;
  dueAt?: string | null;
  scheduledFor?: string | null;
  completedAt?: string | null;
  cancelledReason?: string | null;
  createdAt!: string;
  updatedAt!: string;
  payload?: Record<string, unknown> | null;
  assigneeId?: NullableString;
  priority?: NullableString;
  context?: TaskContextResponseDto | null;

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
    dto.cancelledReason = entity.cancelledReason ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    dto.payload = entity.payload ?? null;

    const payload = entity.payload;
    if (isRecord(payload)) {
      const assigneeId = extractString(payload.assigneeId ?? payload['assignee_id']);
      dto.assigneeId = assigneeId;

      const priority = extractString(payload.priority);
      dto.priority = priority;

      const rawContext = payload.context;
      if (isRecord(rawContext)) {
        const dealId = extractString(rawContext.dealId ?? rawContext['deal_id']);
        const policyId = extractString(rawContext.policyId ?? rawContext['policy_id']);
        const context: TaskContextResponseDto = {};

        if (dealId) {
          context.dealId = dealId;
        }

        if (policyId) {
          context.policyId = policyId;
        }

        dto.context = Object.keys(context).length > 0 ? context : null;
      } else {
        dto.context = null;
      }
    } else {
      dto.assigneeId = null;
      dto.priority = null;
      dto.context = null;
    }

    return dto;
  }
}
