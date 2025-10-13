import { TaskStatusCode } from '../constants/task-status.constants';

export class CreateTaskCommand {
  constructor(
    public readonly title: string,
    public readonly description: string | undefined,
    public readonly dueAt: Date | undefined,
    public readonly scheduledFor: Date | undefined,
    public readonly payload: Record<string, unknown> | undefined,
    public readonly initialStatus: TaskStatusCode,
    public readonly assigneeId: string,
    public readonly authorId: string,
    public readonly priority: string | undefined,
    public readonly context: Record<string, unknown> | undefined
  ) {}
}
