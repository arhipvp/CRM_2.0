import { TaskEntity } from '../entities/task.entity';

type NullableString = string | null;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const extractString = (value: unknown): NullableString => {
  return typeof value === 'string' ? value : null;
};

const toCamelCase = (key: string): string => {
  return key.replace(/_([a-zA-Z0-9])/g, (_, letter: string) => letter.toUpperCase());
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
  dealId?: NullableString;
  clientId?: NullableString;
  context?: Record<string, string> | null;

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

      const dealId = extractString(payload.dealId ?? payload['deal_id']);
      dto.dealId = dealId;

      const clientId = extractString(payload.clientId ?? payload['client_id']);
      dto.clientId = clientId;

      const rawContext = payload.context;
      if (isRecord(rawContext)) {
        const entries: [string, string][] = [];

        for (const [rawKey, rawValue] of Object.entries(rawContext)) {
          const value = extractString(rawValue);

          if (value === null) {
            continue;
          }

          const key = toCamelCase(rawKey);
          entries.push([key, value]);
        }

        dto.context = entries.length > 0 ? Object.fromEntries(entries) : null;
      } else {
        dto.context = null;
      }
    } else {
      dto.assigneeId = null;
      dto.priority = null;
      dto.dealId = null;
      dto.clientId = null;
      dto.context = null;
    }

    return dto;
  }
}
