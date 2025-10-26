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
        status_code varchar(32) NOT NULL,
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
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_tasks_status_code FOREIGN KEY (status_code)
          REFERENCES tasks.task_statuses(code) ON UPDATE CASCADE,
        CONSTRAINT fk_tasks_assignee_id FOREIGN KEY (assignee_id)
          REFERENCES auth.users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_tasks_author_id FOREIGN KEY (author_id)
          REFERENCES auth.users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_tasks_deal_id FOREIGN KEY (deal_id)
          REFERENCES crm.deals(id) ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_tasks_policy_id FOREIGN KEY (policy_id)
          REFERENCES crm.policies(id) ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_tasks_payment_id FOREIGN KEY (payment_id)
          REFERENCES crm.payments(id) ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_tasks_status_code ON tasks.tasks(status_code)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_tasks_status_code_due_at
        ON tasks.tasks(status_code, due_at)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_tasks_assignee_id ON tasks.tasks(assignee_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_tasks_deal_id ON tasks.tasks(deal_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_tasks_scheduled_for
        ON tasks.tasks(scheduled_for) WHERE scheduled_for IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_tasks_due_at
        ON tasks.tasks(due_at) WHERE due_at IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tasks.task_activity (
        id uuid PRIMARY KEY,
        task_id uuid NOT NULL,
        author_id uuid NOT NULL,
        event_type varchar(64) NOT NULL,
        body text NULL,
        payload jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_task_activity_task_id FOREIGN KEY (task_id)
          REFERENCES tasks.tasks(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_task_activity_author_id FOREIGN KEY (author_id)
          REFERENCES auth.users(id) ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_task_activity_created_at
        ON tasks.task_activity(created_at)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tasks.task_reminders (
        id uuid PRIMARY KEY,
        task_id uuid NOT NULL,
        remind_at timestamptz NOT NULL,
        channel varchar(32) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_task_reminders_task_id FOREIGN KEY (task_id)
          REFERENCES tasks.tasks(id) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_task_reminders_due ON tasks.task_reminders(remind_at)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_task_reminders_unique
        ON tasks.task_reminders(task_id, remind_at, channel)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS tasks.idx_task_reminders_unique`);
    await queryRunner.query(`DROP INDEX IF EXISTS tasks.ix_task_reminders_due`);
    await queryRunner.query(`DROP TABLE IF EXISTS tasks.task_reminders`);

    await queryRunner.query(`DROP INDEX IF EXISTS tasks.ix_task_activity_created_at`);
    await queryRunner.query(`DROP TABLE IF EXISTS tasks.task_activity`);

    await queryRunner.query(`DROP INDEX IF EXISTS tasks.ix_tasks_due_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS tasks.ix_tasks_scheduled_for`);
    await queryRunner.query(`DROP INDEX IF EXISTS tasks.ix_tasks_deal_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS tasks.ix_tasks_assignee_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS tasks.ix_tasks_status_code_due_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS tasks.ix_tasks_status_code`);
    await queryRunner.query(`DROP TABLE IF EXISTS tasks.tasks`);

    await queryRunner.query(`DROP TABLE IF EXISTS tasks.task_statuses`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS tasks`);
  }
}
