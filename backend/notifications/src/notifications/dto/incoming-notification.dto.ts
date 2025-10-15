import { IsString, IsOptional, IsObject, IsUUID, IsISO8601 } from 'class-validator';

export class IncomingNotificationDto {
  @IsUUID()
  id!: string;

  @IsString()
  source!: string;

  @IsString()
  type!: string;

  @IsISO8601()
  time!: string;

  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  chatId?: string;
}
