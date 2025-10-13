import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskReminders1700000003000 implements MigrationInterface {
  name = 'CreateTaskReminders1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tasks.task_reminders (
        id uuid PRIMARY KEY,
        task_id uuid NOT NULL REFERENCES tasks.tasks(id) ON DELETE CASCADE,
        remind_at timestamptz NOT NULL,
        channel varchar(32) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_task_reminders_unique
        ON tasks.task_reminders(task_id, remind_at, channel)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_reminders_due
        ON tasks.task_reminders(remind_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tasks.task_reminders`);
  }
}
