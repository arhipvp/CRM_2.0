import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskReminders1700000003000 implements MigrationInterface {
  name = 'CreateTaskReminders1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // С 1700000000000-CreateTasksSchema структура reminders создаётся базовой миграцией.
    // Файл сохранён для совместимости с историей, поэтому выполняем лишь no-op.
    return Promise.resolve();
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    return Promise.resolve();
  }
}
