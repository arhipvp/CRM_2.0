import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTelegramDeliveryColumns1710000000001 implements MigrationInterface {
  name = 'AddTelegramDeliveryColumns1710000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('notification_events', [
      new TableColumn({
        name: 'telegramMessageId',
        type: 'varchar',
        length: '128',
        isNullable: true
      }),
      new TableColumn({
        name: 'telegramDeliveryStatus',
        type: 'varchar',
        length: '32',
        isNullable: true
      }),
      new TableColumn({
        name: 'telegramDeliveryReason',
        type: 'text',
        isNullable: true
      }),
      new TableColumn({
        name: 'telegramDeliveryOccurredAt',
        type: 'timestamptz',
        isNullable: true
      })
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('notification_events', 'telegramDeliveryOccurredAt');
    await queryRunner.dropColumn('notification_events', 'telegramDeliveryReason');
    await queryRunner.dropColumn('notification_events', 'telegramDeliveryStatus');
    await queryRunner.dropColumn('notification_events', 'telegramMessageId');
  }
}
