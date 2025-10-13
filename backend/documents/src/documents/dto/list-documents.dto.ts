import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

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

  @IsOptional()
  @Expose({ name: 'owner_id' })
  @IsUUID('4')
  @Transform(({ value, obj }) => {
    const raw = value ?? obj.owner_id ?? obj.ownerId;
    if (typeof raw !== 'string') {
      return undefined;
    }

    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, { toClassOnly: true })
  ownerId?: string;

  @IsOptional()
  @Expose({ name: 'owner_type' })
  @IsString()
  @Transform(({ value, obj }) => {
    const raw = value ?? obj.owner_type ?? obj.ownerType;
    if (typeof raw !== 'string') {
      return undefined;
    }

    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, { toClassOnly: true })
  ownerType?: string;

  @IsOptional()
  @Expose({ name: 'document_type' })
  @IsArray()
  @IsString({ each: true })
  @Transform(
    ({ value, obj }) => {
      const raw = value ?? obj.document_type ?? obj['document_type[]'] ?? obj.documentType;
      if (raw === undefined || raw === null || raw === '') {
        return undefined;
      }

      const ensureArray = Array.isArray(raw) ? raw : String(raw).split(',');
      const normalized = ensureArray
        .map((item) => (typeof item === 'string' ? item.trim() : item))
        .filter((item): item is string => Boolean(item));

      return normalized.length > 0 ? normalized : undefined;
    },
    { toClassOnly: true },
  )
  documentType?: string[];

  @IsOptional()
  @Expose()
  @IsString()
  @Transform(({ value, obj }) => {
    const raw = value ?? obj.search ?? obj.q;
    if (typeof raw !== 'string') {
      return undefined;
    }

    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, { toClassOnly: true })
  search?: string;
}
