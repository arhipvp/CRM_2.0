import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { NotificationEntity } from './notification.entity';

type AttemptJsonColumnType = 'jsonb' | 'simple-json';
const ATTEMPT_JSON_COLUMN_TYPE: AttemptJsonColumnType =
  process.env.NOTIFICATIONS_USE_SIMPLE_JSON === 'true' ? 'simple-json' : 'jsonb';

type AttemptDateColumnType = 'timestamp with time zone' | 'datetime';
const ATTEMPT_DATE_COLUMN_TYPE: AttemptDateColumnType =
  process.env.NOTIFICATIONS_USE_SIMPLE_JSON === 'true'
    ? 'datetime'
    : 'timestamp with time zone';

export enum NotificationDeliveryAttemptStatus {
  Queued = 'queued',
  Sent = 'sent',
  Failed = 'failed'
}

@Entity({ name: 'notification_delivery_attempts' })
export class NotificationDeliveryAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => NotificationEntity, (notification) => notification.attempts, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  notification!: NotificationEntity;

  @Column({ type: 'varchar', length: 50 })
  channel!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: NotificationDeliveryAttemptStatus.Queued
  })
  status!: NotificationDeliveryAttemptStatus;

  @Column({ type: ATTEMPT_JSON_COLUMN_TYPE, nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error?: string | null;

  @CreateDateColumn({ type: ATTEMPT_DATE_COLUMN_TYPE })
  createdAt!: Date;
}
