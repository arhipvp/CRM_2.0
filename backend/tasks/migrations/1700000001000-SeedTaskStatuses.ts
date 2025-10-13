import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedTaskStatuses1700000001000 implements MigrationInterface {
  name = 'SeedTaskStatuses1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO tasks.task_statuses (code, name, description, is_final)
      VALUES
        ('pending', 'Ожидает выполнения', 'Задача готова к взятию в работу или ожиданию воркера.', false),
        ('scheduled', 'Отложена', 'Задача ожидает наступления времени исполнения в Redis-очереди.', false),
        ('in_progress', 'В работе', 'Задача обрабатывается исполнителем или автоматикой.', false),
        ('completed', 'Завершена', 'Работа по задаче завершена успешно.', true),
        ('cancelled', 'Отменена', 'Задача отменена и не требует дальнейшей обработки.', true)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        is_final = EXCLUDED.is_final;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM tasks.task_statuses
      WHERE code IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled');
    `);
  }
}
