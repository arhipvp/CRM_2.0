import { TaskReminderEntity } from '../entities/task-reminder.entity';
import { TaskReminderChannel } from '../constants/task-reminder-channel.constants';

export class TaskReminderResponseDto {
  id!: string;
  taskId!: string;
  remindAt!: string;
  channel!: TaskReminderChannel;
  createdAt!: string;

  static fromEntity(entity: TaskReminderEntity): TaskReminderResponseDto {
    const dto = new TaskReminderResponseDto();
    dto.id = entity.id;
    dto.taskId = entity.taskId;
    dto.remindAt = entity.remindAt.toISOString();
    dto.channel = entity.channel;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}
