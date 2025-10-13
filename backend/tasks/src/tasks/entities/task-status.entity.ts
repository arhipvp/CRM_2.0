import { Column, Entity, PrimaryColumn } from 'typeorm';
import { TaskStatusCode } from '../constants/task-status.constants';

@Entity({ name: 'task_statuses', schema: 'tasks' })
export class TaskStatusEntity {
  @PrimaryColumn('varchar', { length: 32 })
  code!: TaskStatusCode;

  @Column('varchar', { length: 128 })
  name!: string;

  @Column('text', { nullable: true })
  description?: string | null;

  @Column('boolean', { name: 'is_final', default: false })
  isFinal!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
