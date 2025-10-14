import { Expose, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const OWNER_TYPES = ['client', 'deal', 'policy', 'payment'] as const;
export type DocumentOwnerType = (typeof OWNER_TYPES)[number];

const pickCaseValue = <T>(value: T, obj: Record<string, any>, ...aliases: string[]): T => {
  if (value !== undefined) {
    return value;
  }
  for (const alias of aliases) {
    if (obj[alias] !== undefined) {
      return obj[alias];
    }
  }
  return value;
};

const toStringArray = (input: unknown): string[] | undefined => {
  if (input === null || input === undefined) {
    return undefined;
  }
  if (Array.isArray(input)) {
    return input.map((item) => String(item));
  }
  if (typeof input === 'string') {
    if (!input.trim()) {
      return [];
    }
    return input
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [String(input)];
};

export class CreateDocumentDto {
  @Expose()
  @Transform(({ value, obj }) => pickCaseValue(value, obj, 'owner_type'), { toClassOnly: true })
  @IsNotEmpty()
  @IsString()
  @IsIn(OWNER_TYPES)
  ownerType!: DocumentOwnerType;

  @Expose()
  @Transform(({ value, obj }) => pickCaseValue(value, obj, 'owner_id'), { toClassOnly: true })
  @IsUUID()
  ownerId!: string;

  @Expose()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @Expose()
  @Transform(({ value, obj }) => pickCaseValue(value, obj, 'document_type'), { toClassOnly: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  documentType?: string;

  @Expose()
  @IsOptional()
  @IsString()
  notes?: string;

  @Expose()
  @Transform(({ value, obj }) => toStringArray(pickCaseValue(value, obj, 'tags')), { toClassOnly: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tags?: string[];
}
