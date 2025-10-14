import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum FolderOwnerType {
  Client = 'client',
  Deal = 'deal',
  Policy = 'policy',
  Payment = 'payment',
}

@Entity({ name: 'folders' })
@Index('folders_owner_idx', ['ownerType', 'ownerId'], { unique: true })
export class FolderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'owner_type', type: 'varchar', length: 32 })
  ownerType!: FolderOwnerType;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ name: 'drive_folder_id', length: 255 })
  driveFolderId!: string;

  @Column({ name: 'parent_folder_id', length: 255, nullable: true })
  parentFolderId?: string | null;

  @Column({ name: 'web_link', type: 'varchar', length: 1024, nullable: true })
  webLink?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
