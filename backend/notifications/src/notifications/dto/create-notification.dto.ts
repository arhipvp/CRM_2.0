import {
  ArrayNotEmpty,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';
import { Expose, Type } from 'class-transformer';

export class NotificationRecipientDto {
  @Expose({ name: 'user_id' })
  @IsString()
  userId!: string;

  @Expose({ name: 'telegram_id' })
  @IsOptional()
  @IsString()
  telegramId?: string;
}

export class CreateNotificationDto {
  @Expose({ name: 'event_key' })
  @IsString()
  eventKey!: string;

  @Expose()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => NotificationRecipientDto)
  recipients!: NotificationRecipientDto[];

  @Expose()
  @IsObject()
  payload!: Record<string, unknown>;

  @Expose({ name: 'channel_overrides' })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  channelOverrides?: string[];

  @Expose({ name: 'deduplication_key' })
  @IsOptional()
  @IsString()
  deduplicationKey?: string;
}
