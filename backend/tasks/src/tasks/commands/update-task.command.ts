import { TaskStatusCode } from '../constants/task-status.constants';

export class UpdateTaskCommand {
  constructor(
    public readonly taskId: string,
    public readonly status?: TaskStatusCode,
    public readonly dueAt?: Date | null,
    public readonly completedAt?: Date | null,
    public readonly cancelledReason?: string | null
  ) {}
}
