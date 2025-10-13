import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { TaskEntity } from './task.entity';
import { TaskReminderChannel } from '../constants/task-reminder-channel.constants';

@Entity({ name: 'task_reminders', schema: 'tasks' })
@Index(['taskId', 'remindAt', 'channel'], { unique: true })
export class TaskReminderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: string;

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id', referencedColumnName: 'id' })
  task!: TaskEntity;

  @Column({ name: 'remind_at', type: 'timestamptz' })
  remindAt!: Date;

  @Column({ type: 'varchar', length: 32 })
  channel!: TaskReminderChannel;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
