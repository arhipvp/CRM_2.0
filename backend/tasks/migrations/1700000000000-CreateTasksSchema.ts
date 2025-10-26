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
        status_code varchar(32) NOT NULL REFERENCES tasks.task_statuses(code) ON UPDATE CASCADE,
        due_at timestamptz NULL,
        scheduled_for timestamptz NULL,
        payload jsonb NULL,
        assignee_id uuid NOT NULL,
        author_id uuid NOT NULL,
        deal_id uuid NULL,
        policy_id uuid NULL,
        payment_id uuid NULL,
        completed_at timestamptz NULL,
        cancelled_reason text NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tasks.task_activity (
        id uuid PRIMARY KEY,
        task_id uuid NOT NULL REFERENCES tasks.tasks(id) ON DELETE CASCADE ON UPDATE CASCADE,
        author_id uuid NOT NULL,
        event_type varchar(64) NOT NULL,
        body text NULL,
        payload jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tasks.task_activity`);
    await queryRunner.query(`DROP TABLE IF EXISTS tasks.tasks`);
    await queryRunner.query(`DROP TABLE IF EXISTS tasks.task_statuses`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS tasks`);
  }
}
