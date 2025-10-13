import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

export class NotificationRecipientDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsOptional()
  @IsString()
  telegramId?: string;
}

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  eventKey!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => NotificationRecipientDto)
  recipients!: NotificationRecipientDto[];

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channelOverrides?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deduplicationKey?: string;
}
