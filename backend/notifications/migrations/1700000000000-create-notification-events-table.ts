import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateNotificationEventsTable1700000000000 implements MigrationInterface {
  name = 'CreateNotificationEventsTable1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notification_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()'
          },
          {
            name: 'eventType',
            type: 'varchar',
            length: '255',
            isNullable: false
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: false
          },
          {
            name: 'deliveredToTelegram',
            type: 'boolean',
            isNullable: false,
            default: false
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()'
          }
        ]
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notification_events');
  }
}
