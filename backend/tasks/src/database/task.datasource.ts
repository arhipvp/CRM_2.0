import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { TaskEntity } from '../tasks/entities/task.entity';
import { TaskStatusEntity } from '../tasks/entities/task-status.entity';
import { TaskReminderEntity } from '../tasks/entities/task-reminder.entity';

const databaseUrl = process.env.TASKS_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('TASKS_DATABASE_URL is not set');
}

export const taskDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: databaseUrl,
  entities: [TaskEntity, TaskStatusEntity, TaskReminderEntity],
  migrations: ['migrations/*.ts'],
  migrationsTableName: 'tasks_migrations',
  schema: 'tasks',
  synchronize: false,
  logging: (process.env.TASKS_TYPEORM_LOGGING ?? 'false').toLowerCase() === 'true'
};

export const createTaskDataSource = () => new DataSource(taskDataSourceOptions);

export default createTaskDataSource;
