import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { TaskStatusCode } from '../constants/task-status.constants';

export class UpdateTaskDto {
  @IsOptional()
  @IsEnum(TaskStatusCode)
  status?: TaskStatusCode;

  @IsOptional()
  @IsISO8601()
  dueDate?: string | null;

  @IsOptional()
  @IsISO8601()
  completedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  cancelledReason?: string | null;
}
