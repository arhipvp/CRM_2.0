import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn
} from 'typeorm';

export enum NotificationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DELIVERED = 'delivered',
  FAILED = 'failed'
}

@Entity({ name: 'notification_events' })
export class NotificationEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({
    type: 'varchar',
    length: 32,
    default: NotificationStatus.PENDING
  })
  status!: NotificationStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({
    type: 'text',
    array: true,
    default: () => "'{}'"
  })
  channels!: string[];

  @Column({ type: 'boolean', default: false })
  deliveredToTelegram!: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  deliveredAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
