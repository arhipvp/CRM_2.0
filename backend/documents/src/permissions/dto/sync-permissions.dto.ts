import { Expose } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { FolderOwnerType } from '../../folders/folder.entity';

export class SyncPermissionsDto {
  @Expose({ name: 'owner_type' })
  @IsEnum(FolderOwnerType)
  ownerType!: FolderOwnerType;

  @Expose({ name: 'owner_id' })
  @IsUUID()
  ownerId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(255, { each: true })
  users!: string[];
}
