import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUploadedStatus1739126400000 implements MigrationInterface {
  private readonly schema = process.env.DOCUMENTS_DATABASE_SCHEMA ?? 'documents';
  private readonly tableName = `${this.schema}.documents`;
  private readonly statusEnum = `${this.schema}_documents_status_enum`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = '${this.statusEnum}' AND e.enumlabel = 'uploaded'
        ) THEN
          ALTER TYPE "${this.statusEnum}" ADD VALUE 'uploaded';
        END IF;
      END;
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tempEnum = `${this.statusEnum}_new`;

    await queryRunner.query(`UPDATE ${this.tableName} SET status = 'uploading' WHERE status = 'uploaded';`);
    await queryRunner.query(`CREATE TYPE "${tempEnum}" AS ENUM ('draft', 'pending_upload', 'uploading', 'synced', 'error');`);
    await queryRunner.query(
      `ALTER TABLE ${this.tableName} ALTER COLUMN status TYPE "${tempEnum}" USING status::text::"${tempEnum}";`,
    );
    await queryRunner.query(`DROP TYPE "${this.statusEnum}";`);
    await queryRunner.query(`ALTER TYPE "${tempEnum}" RENAME TO "${this.statusEnum}";`);
  }
}
