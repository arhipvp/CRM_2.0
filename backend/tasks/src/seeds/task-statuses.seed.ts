import { createTaskDataSource } from '../database/task.datasource';
import { TaskStatusEntity } from '../tasks/entities/task-status.entity';
import { DEFAULT_TASK_STATUSES } from '../tasks/constants/task-status.constants';

async function run() {
  const dataSource = createTaskDataSource();
  await dataSource.initialize();
  const repository = dataSource.getRepository(TaskStatusEntity);

  for (const status of DEFAULT_TASK_STATUSES) {
    await repository.upsert(status, {
      conflictPaths: ['code']
    });
  }

  await dataSource.destroy();
  // eslint-disable-next-line no-console
  console.log('Task statuses seed applied successfully');
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to seed task statuses', error);
  process.exit(1);
});
