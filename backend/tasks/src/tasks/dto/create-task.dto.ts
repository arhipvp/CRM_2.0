import { IsISO8601, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @IsOptional()
  @IsISO8601()
  scheduledFor?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
