import { Expose } from 'class-transformer';
import { IsEnum, IsUUID } from 'class-validator';

import { FolderOwnerType } from '../folder.entity';

export class FindFolderParamsDto {
  @Expose({ name: 'ownerType' })
  @IsEnum(FolderOwnerType)
  ownerType!: FolderOwnerType;

  @Expose({ name: 'ownerId' })
  @IsUUID()
  ownerId!: string;
}
