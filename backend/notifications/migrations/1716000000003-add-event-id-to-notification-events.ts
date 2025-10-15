import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEventIdToNotificationEvents1716000000003 implements MigrationInterface {
  name = 'AddEventIdToNotificationEvents1716000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'notification_events',
      new TableColumn({
        name: 'eventId',
        type: 'uuid',
        isNullable: true
      })
    );

    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_events_event_id ON notification_events("eventId") WHERE "eventId" IS NOT NULL'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_notification_events_event_id');
    await queryRunner.dropColumn('notification_events', 'eventId');
  }
}
