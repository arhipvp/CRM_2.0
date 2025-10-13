import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { TaskReminderChannel } from '../constants/task-reminder-channel.constants';

export class CreateReminderDto {
  @Expose({ name: 'remind_at' })
  @Transform(({ value, obj }) => value ?? obj.remind_at ?? obj['remind_at'])
  @IsISO8601()
  remindAt!: string;

  @IsOptional()
  @Expose({ name: 'channel' })
  @Transform(({ value, obj }) => value ?? obj.channel ?? obj['channel'] ?? TaskReminderChannel.SSE)
  @IsEnum(TaskReminderChannel)
  channel: TaskReminderChannel = TaskReminderChannel.SSE;
}
