import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

export enum NotificationTemplateChannel {
  SSE = 'sse',
  TELEGRAM = 'telegram'
}

export enum NotificationTemplateStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}

@Entity({ name: 'notification_templates' })
@Index(['key', 'channel'], { unique: true })
export class NotificationTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  key!: string;

  @Column({ type: 'varchar', length: 32 })
  channel!: NotificationTemplateChannel;

  @Column({ type: 'varchar', length: 16 })
  locale!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 32, default: NotificationTemplateStatus.ACTIVE })
  status!: NotificationTemplateStatus;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
