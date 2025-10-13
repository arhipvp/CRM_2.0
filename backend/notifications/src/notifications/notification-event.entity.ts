import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn
} from 'typeorm';

@Entity({ name: 'notification_events' })
export class NotificationEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  deliveredToTelegram!: boolean;

  @Column({ type: 'varchar', length: 128, nullable: true })
  telegramMessageId!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  telegramDeliveryStatus!: string | null;

  @Column({ type: 'text', nullable: true })
  telegramDeliveryReason!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  telegramDeliveryOccurredAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
