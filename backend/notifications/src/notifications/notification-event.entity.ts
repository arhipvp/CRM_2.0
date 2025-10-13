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

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
