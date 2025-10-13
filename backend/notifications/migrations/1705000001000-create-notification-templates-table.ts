import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateNotificationTemplatesTable1705000001000 implements MigrationInterface {
  name = 'CreateNotificationTemplatesTable1705000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notification_templates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()'
          },
          {
            name: 'key',
            type: 'varchar',
            length: '255',
            isNullable: false
          },
          {
            name: 'channel',
            type: 'varchar',
            length: '32',
            isNullable: false
          },
          {
            name: 'locale',
            type: 'varchar',
            length: '16',
            isNullable: false,
            default: "'ru-RU'"
          },
          {
            name: 'body',
            type: 'text',
            isNullable: false
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: false,
            default: "'{}'::jsonb"
          },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            isNullable: false,
            default: "'active'"
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()'
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()'
          }
        ]
      })
    );

    await queryRunner.createIndex(
      'notification_templates',
      new TableIndex({
        name: 'IDX_notification_templates_key_channel',
        columnNames: ['key', 'channel'],
        isUnique: true
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('notification_templates', 'IDX_notification_templates_key_channel');
    await queryRunner.dropTable('notification_templates');
  }
}
