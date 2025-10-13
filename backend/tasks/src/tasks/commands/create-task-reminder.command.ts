import { TaskReminderChannel } from '../constants/task-reminder-channel.constants';

export class CreateTaskReminderCommand {
  constructor(
    public readonly taskId: string,
    public readonly remindAt: Date,
    public readonly channel: TaskReminderChannel
  ) {}
}
