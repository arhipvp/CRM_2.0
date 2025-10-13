export class CompleteTaskCommand {
  constructor(
    public readonly taskId: string,
    public readonly completedAt?: Date
  ) {}
}
