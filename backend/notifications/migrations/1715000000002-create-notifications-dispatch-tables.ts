import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateNotificationsDispatchTables1715000000002 implements MigrationInterface {
  name = 'CreateNotificationsDispatchTables1715000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()'
          },
          {
            name: 'eventKey',
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
            name: 'recipients',
            type: 'jsonb',
            isNullable: false
          },
          {
            name: 'channelOverrides',
            type: 'text',
            isArray: true,
            isNullable: true
          },
          {
            name: 'deduplicationKey',
            type: 'varchar',
            length: '255',
            isNullable: true,
            isUnique: true
          },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            default: `'pending'`
          },
          {
            name: 'attemptsCount',
            type: 'integer',
            default: 0
          },
          {
            name: 'lastAttemptAt',
            type: 'timestamptz',
            isNullable: true
          },
          {
            name: 'lastError',
            type: 'text',
            isNullable: true
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

    await queryRunner.createTable(
      new Table({
        name: 'notification_delivery_attempts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()'
          },
          {
            name: 'notificationId',
            type: 'uuid',
            isNullable: false
          },
          {
            name: 'attemptNumber',
            type: 'integer',
            isNullable: false
          },
          {
            name: 'channel',
            type: 'varchar',
            length: '64',
            isNullable: false
          },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            isNullable: false
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true
          },
          {
            name: 'error',
            type: 'text',
            isNullable: true
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()'
          }
        ]
      })
    );

    await queryRunner.createForeignKey(
      'notification_delivery_attempts',
      new TableForeignKey({
        columnNames: ['notificationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'notifications',
        onDelete: 'CASCADE'
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('notification_delivery_attempts');
    const foreignKey = table?.foreignKeys.find((fk) => fk.columnNames.includes('notificationId'));
    if (foreignKey) {
      await queryRunner.dropForeignKey('notification_delivery_attempts', foreignKey);
    }
    await queryRunner.dropTable('notification_delivery_attempts');
    await queryRunner.dropTable('notifications');
  }
}
