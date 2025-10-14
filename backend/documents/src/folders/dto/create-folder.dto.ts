import { Expose } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { FolderOwnerType } from '../folder.entity';

export class CreateFolderDto {
  @Expose({ name: 'owner_type' })
  @IsEnum(FolderOwnerType)
  ownerType!: FolderOwnerType;

  @Expose({ name: 'owner_id' })
  @IsUUID()
  ownerId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @Expose({ name: 'parent_folder_id' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  parentFolderId?: string;
}
