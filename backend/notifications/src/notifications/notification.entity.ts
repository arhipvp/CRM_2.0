import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { NotificationDeliveryAttemptEntity } from './notification-delivery-attempt.entity';

type NotificationJsonColumnType = 'jsonb' | 'simple-json';
const JSON_COLUMN_TYPE: NotificationJsonColumnType =
  process.env.NOTIFICATIONS_USE_SIMPLE_JSON === 'true' ? 'simple-json' : 'jsonb';

type NotificationDateColumnType = 'timestamp with time zone' | 'datetime';
const DATE_COLUMN_TYPE: NotificationDateColumnType =
  process.env.NOTIFICATIONS_USE_SIMPLE_JSON === 'true'
    ? 'datetime'
    : 'timestamp with time zone';

export interface NotificationRecipient {
  userId: string;
  telegramId?: string | null;
}

export enum NotificationStatus {
  Pending = 'pending',
  Processing = 'processing',
  Failed = 'failed'
}

@Entity({ name: 'notifications' })
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  eventKey!: string;

  @Column({ type: JSON_COLUMN_TYPE })
  recipients!: NotificationRecipient[];

  @Column({ type: JSON_COLUMN_TYPE })
  payload!: Record<string, unknown>;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  channelOverrides?: string[] | null;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  deduplicationKey?: string | null;

  @Column({ type: 'varchar', length: 50, default: NotificationStatus.Pending })
  status!: NotificationStatus;

  @OneToMany(() => NotificationDeliveryAttemptEntity, (attempt) => attempt.notification)
  attempts!: NotificationDeliveryAttemptEntity[];

  @CreateDateColumn({ type: DATE_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: DATE_COLUMN_TYPE })
  updatedAt!: Date;
}
