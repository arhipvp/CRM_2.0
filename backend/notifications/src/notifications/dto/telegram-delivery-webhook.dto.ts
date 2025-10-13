import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';

export enum TelegramDeliveryWebhookStatus {
  Delivered = 'delivered',
  Failed = 'failed'
}

export class TelegramDeliveryWebhookDto {
  @IsString()
  messageId!: string;

  @IsEnum(TelegramDeliveryWebhookStatus)
  status!: TelegramDeliveryWebhookStatus;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsISO8601()
  occurredAt!: string;
}
