import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { NotificationDeliveryAttemptEntity } from './notification-delivery-attempt.entity';

export interface NotificationRecipient {
  userId: string;
  telegramId?: string;
}

export enum NotificationStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  PROCESSED = 'processed',
  FAILED = 'failed'
}

@Entity({ name: 'notifications' })
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  eventKey!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  recipients!: NotificationRecipient[];

  @Column({ type: 'text', array: true, nullable: true })
  channelOverrides!: string[] | null;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  deduplicationKey!: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    default: NotificationStatus.PENDING
  })
  status!: NotificationStatus;

  @Column({ type: 'integer', default: 0 })
  attemptsCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastAttemptAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  @OneToMany(() => NotificationDeliveryAttemptEntity, (attempt) => attempt.notification)
  attempts!: NotificationDeliveryAttemptEntity[];
}
