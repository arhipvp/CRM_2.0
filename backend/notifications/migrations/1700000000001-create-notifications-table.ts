import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex
} from 'typeorm';

export class CreateNotificationsTable1700000000001 implements MigrationInterface {
  name = 'CreateNotificationsTable1700000000001';

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
            name: 'recipients',
            type: 'jsonb',
            isNullable: false
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: false
          },
          {
            name: 'channelOverrides',
            type: 'jsonb',
            isNullable: true
          },
          {
            name: 'deduplicationKey',
            type: 'varchar',
            length: '255',
            isNullable: true
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            isNullable: false,
            default: "'pending'"
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()'
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
            onUpdate: 'now()'
          }
        ]
      })
    );

    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'IDX_notifications_deduplicationKey',
        columnNames: ['deduplicationKey'],
        isUnique: true,
        where: '"deduplicationKey" IS NOT NULL'
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
            name: 'channel',
            type: 'varchar',
            length: '50',
            isNullable: false
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'queued'"
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

    await queryRunner.createIndex(
      'notification_delivery_attempts',
      new TableIndex({
        name: 'IDX_notification_delivery_attempts_notificationId',
        columnNames: ['notificationId']
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'notification_delivery_attempts',
      'IDX_notification_delivery_attempts_notificationId'
    );
    const attemptsTable = await queryRunner.getTable('notification_delivery_attempts');
    if (attemptsTable) {
      const foreignKey = attemptsTable.foreignKeys.find((fk) => fk.columnNames.includes('notificationId'));
      if (foreignKey) {
        await queryRunner.dropForeignKey('notification_delivery_attempts', foreignKey);
      }
    }
    await queryRunner.dropTable('notification_delivery_attempts');
    await queryRunner.dropIndex('notifications', 'IDX_notifications_deduplicationKey');
    await queryRunner.dropTable('notifications');
  }
}
