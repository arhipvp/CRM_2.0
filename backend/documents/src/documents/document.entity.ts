import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { DocumentStatus } from './document-status.enum';

@Entity({ name: 'documents' })
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  @Index('documents_name_idx')
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'drive_file_id', nullable: true })
  @Index('documents_drive_file_id_idx')
  driveFileId?: string | null;

  @Column({ name: 'drive_revision_id', nullable: true })
  driveRevisionId?: string | null;

  @Column({ name: 'mime_type', length: 255, nullable: true })
  mimeType?: string | null;

  @Column({ type: 'bigint', nullable: true })
  size?: string | null;

  @Column({ name: 'checksum_md5', length: 32, nullable: true })
  checksumMd5?: string | null;

  @Column({ name: 'source_uri', type: 'text', nullable: true })
  sourceUri?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.PendingUpload })
  status!: DocumentStatus;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ name: 'uploaded_at', type: 'timestamptz', nullable: true })
  uploadedAt?: Date | null;

  @Column({ name: 'synced_at', type: 'timestamptz', nullable: true })
  syncedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
