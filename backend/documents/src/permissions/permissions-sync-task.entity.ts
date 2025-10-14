import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { FolderOwnerType } from '../folders/folder.entity';

@Entity({ name: 'permissions_sync_tasks' })
export class PermissionsSyncTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'owner_type', type: 'varchar', length: 32 })
  ownerType!: FolderOwnerType;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({ name: 'drive_folder_id', type: 'varchar', length: 255 })
  driveFolderId!: string;

  @Column({ name: 'job_id', type: 'varchar', length: 255 })
  jobId!: string;

  @Column({ type: 'jsonb' })
  users!: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
