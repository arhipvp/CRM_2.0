import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TaskPriority } from './list-tasks.dto';

export class CreateTaskDto {
  @IsString()
  @MaxLength(255)
  subject!: string;

  @Expose({ name: 'assignee_id' })
  @Transform(({ value, obj }) => value ?? obj.assignee_id ?? obj['assignee_id'])
  @IsUUID()
  assigneeId!: string;

  @Expose({ name: 'author_id' })
  @Transform(({ value, obj }) => value ?? obj.author_id ?? obj['author_id'])
  @IsUUID()
  authorId!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Expose({ name: 'due_date' })
  @Transform(({ value, obj }) => value ?? obj.due_date ?? obj['due_date'])
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsISO8601()
  scheduledFor?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
