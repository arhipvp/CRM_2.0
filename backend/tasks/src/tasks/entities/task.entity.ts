import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { TaskStatusCode } from '../constants/task-status.constants';
import { TaskStatusEntity } from './task-status.entity';

@Entity({ name: 'tasks', schema: 'tasks' })
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  title!: string;

  @Column('text', { nullable: true })
  description?: string | null;

  @Column('varchar', { name: 'status_code', length: 32 })
  statusCode!: TaskStatusCode;

  @ManyToOne(() => TaskStatusEntity, { eager: true })
  @JoinColumn({ name: 'status_code', referencedColumnName: 'code' })
  status!: TaskStatusEntity;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt?: Date | null;

  @Column({ name: 'scheduled_for', type: 'timestamptz', nullable: true })
  scheduledFor?: Date | null;

  @Column({ name: 'payload', type: 'jsonb', nullable: true })
  payload?: Record<string, unknown> | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
