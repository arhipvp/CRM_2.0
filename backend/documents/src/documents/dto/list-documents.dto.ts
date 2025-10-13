import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { DocumentStatus } from '../document-status.enum';

export class ListDocumentsDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit?: number = 25;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}
