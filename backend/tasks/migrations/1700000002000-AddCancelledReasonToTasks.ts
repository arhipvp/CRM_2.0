import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCancelledReasonToTasks1700000002000 implements MigrationInterface {
  name = 'AddCancelledReasonToTasks1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tasks.tasks ADD COLUMN IF NOT EXISTS cancelled_reason text NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tasks.tasks DROP COLUMN IF EXISTS cancelled_reason`);
  }
}
