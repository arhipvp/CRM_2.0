import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddNotificationStatusColumns1700000001000 implements MigrationInterface {
  name = 'AddNotificationStatusColumns1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('notification_events', [
      new TableColumn({
        name: 'status',
        type: 'varchar',
        length: '32',
        isNullable: false,
        default: "'pending'"
      }),
      new TableColumn({
        name: 'attempts',
        type: 'int',
        isNullable: false,
        default: 0
      }),
      new TableColumn({
        name: 'channels',
        type: 'text',
        isArray: true,
        isNullable: false,
        default: "'{}'"
      }),
      new TableColumn({
        name: 'deliveredAt',
        type: 'timestamptz',
        isNullable: true
      })
    ]);

    await queryRunner.query(
      `UPDATE notification_events
       SET "status" = CASE WHEN "deliveredToTelegram" = true THEN 'delivered' ELSE 'pending' END,
           "attempts" = CASE WHEN "deliveredToTelegram" = true THEN 1 ELSE 0 END,
           "channels" = CASE WHEN "deliveredToTelegram" = true THEN ARRAY['telegram']::text[] ELSE ARRAY['sse']::text[] END,
           "deliveredAt" = CASE WHEN "deliveredToTelegram" = true THEN "createdAt" ELSE NULL END`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('notification_events', 'deliveredAt');
    await queryRunner.dropColumn('notification_events', 'channels');
    await queryRunner.dropColumn('notification_events', 'attempts');
    await queryRunner.dropColumn('notification_events', 'status');
  }
}
