import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddDeletedAtToDocuments1738886400000 implements MigrationInterface {
  private readonly schema = process.env.DOCUMENTS_DATABASE_SCHEMA ?? 'documents';
  private readonly tableName = `${this.schema}.documents`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      this.tableName,
      new TableColumn({ name: 'deleted_at', type: 'timestamptz', isNullable: true }),
    );

    await queryRunner.createIndex(
      this.tableName,
      new TableIndex({ name: 'documents_deleted_at_idx', columnNames: ['deleted_at'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(this.tableName, 'documents_deleted_at_idx');
    await queryRunner.dropColumn(this.tableName, 'deleted_at');
  }
}
