import 'dotenv/config';
import { DataSource } from 'typeorm';
import { TaskEntity } from './src/tasks/entities/task.entity';
import { TaskStatusEntity } from './src/tasks/entities/task-status.entity';

const url = process.env.TASKS_DATABASE_URL;

if (!url) {
  throw new Error('TASKS_DATABASE_URL is not set');
}

export default new DataSource({
  type: 'postgres',
  url,
  entities: [TaskEntity, TaskStatusEntity],
  migrations: ['migrations/*.ts'],
  migrationsTableName: 'tasks_migrations',
  schema: 'tasks',
  synchronize: false,
  logging: (process.env.TASKS_TYPEORM_LOGGING ?? 'false').toLowerCase() === 'true'
});
