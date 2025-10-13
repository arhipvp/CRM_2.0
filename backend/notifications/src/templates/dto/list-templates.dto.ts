import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { NotificationTemplateChannel } from '../notification-template.entity';

export class ListTemplatesDto {
  @IsOptional()
  @IsEnum(NotificationTemplateChannel)
  channel?: NotificationTemplateChannel;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value, obj }) => {
    const source = obj?.active ?? value;
    if (source === undefined || source === null || source === '') {
      return undefined;
    }
    if (typeof source === 'boolean') {
      return source;
    }
    if (typeof source === 'string') {
      const normalized = source.trim().toLowerCase();
      if (['true', '1', 'yes'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no'].includes(normalized)) {
        return false;
      }
    }
    return value;
  })
  active?: boolean;
}
