import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTasksSchema1700000000000 implements MigrationInterface {
  name = 'CreateTasksSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS tasks`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tasks.task_statuses (
        code varchar(32) PRIMARY KEY,
        name varchar(128) NOT NULL,
        description text NULL,
        is_final boolean DEFAULT false NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tasks.tasks (
        id uuid PRIMARY KEY,
        title varchar(255) NOT NULL,
        description text NULL,
        status_code varchar(32) NOT NULL REFERENCES tasks.task_statuses(code),
        due_at timestamptz NULL,
        scheduled_for timestamptz NULL,
        payload jsonb NULL,
        completed_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks.tasks(status_code)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_for ON tasks.tasks(scheduled_for) WHERE scheduled_for IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks.tasks(due_at) WHERE due_at IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tasks.tasks`);
    await queryRunner.query(`DROP TABLE IF EXISTS tasks.task_statuses`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS tasks`);
  }
}
