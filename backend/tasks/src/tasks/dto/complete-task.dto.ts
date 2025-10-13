import { IsISO8601, IsOptional } from 'class-validator';

export class CompleteTaskDto {
  @IsOptional()
  @IsISO8601()
  completedAt?: string;
}
