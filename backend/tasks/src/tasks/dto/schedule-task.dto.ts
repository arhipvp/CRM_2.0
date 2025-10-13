import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class ScheduleTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsISO8601()
  scheduledFor!: string;
}
