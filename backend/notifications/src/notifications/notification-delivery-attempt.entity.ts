import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { NotificationEntity } from './notification.entity';

export enum NotificationDeliveryAttemptStatus {
  SUCCESS = 'success',
  FAILURE = 'failure'
}

@Entity({ name: 'notification_delivery_attempts' })
export class NotificationDeliveryAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  notificationId!: string;

  @ManyToOne(() => NotificationEntity, (notification) => notification.attempts, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'notificationId' })
  notification!: NotificationEntity;

  @Column({ type: 'integer' })
  attemptNumber!: number;

  @Column({ type: 'varchar', length: 64 })
  channel!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: NotificationDeliveryAttemptStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
