export class ScheduleTaskCommand {
  constructor(
    public readonly taskId: string,
    public readonly scheduledFor: Date,
    public readonly title?: string,
    public readonly description?: string
  ) {}
}
