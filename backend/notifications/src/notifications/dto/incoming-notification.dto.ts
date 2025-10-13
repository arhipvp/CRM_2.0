import { IsString, IsOptional, IsObject } from 'class-validator';

export class IncomingNotificationDto {
  @IsString()
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  chatId?: string;
}
