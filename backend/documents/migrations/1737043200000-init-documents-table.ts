import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitDocumentsTable1737043200000 implements MigrationInterface {
  private readonly schema = process.env.DOCUMENTS_DATABASE_SCHEMA ?? 'documents';
  private readonly tableName = `${this.schema}.documents`;
  private readonly statusEnum = `${this.schema}_documents_status_enum`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createSchema(this.schema, true);
    await queryRunner.query(`CREATE TYPE "${this.statusEnum}" AS ENUM ('draft', 'pending_upload', 'uploading', 'synced', 'error')`);

    await queryRunner.createTable(
      new Table({
        name: this.tableName,
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'drive_file_id', type: 'varchar', isNullable: true },
          { name: 'drive_revision_id', type: 'varchar', isNullable: true },
          { name: 'mime_type', type: 'varchar', length: '255', isNullable: true },
          { name: 'size', type: 'bigint', isNullable: true },
          { name: 'checksum_md5', type: 'varchar', length: '32', isNullable: true },
          { name: 'source_uri', type: 'text', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          {
            name: 'status',
            type: `"${this.statusEnum}"`,
            isNullable: false,
            default: `'pending_upload'`,
          },
          { name: 'last_error', type: 'text', isNullable: true },
          { name: 'uploaded_at', type: 'timestamptz', isNullable: true },
          { name: 'synced_at', type: 'timestamptz', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndices(this.tableName, [
      new TableIndex({ name: 'documents_name_idx', columnNames: ['name'] }),
      new TableIndex({ name: 'documents_drive_file_id_idx', columnNames: ['drive_file_id'] }),
      new TableIndex({ name: 'documents_status_idx', columnNames: ['status'] }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(this.tableName, 'documents_name_idx');
    await queryRunner.dropIndex(this.tableName, 'documents_drive_file_id_idx');
    await queryRunner.dropIndex(this.tableName, 'documents_status_idx');
    await queryRunner.dropTable(this.tableName, true);
    await queryRunner.query(`DROP TYPE IF EXISTS "${this.statusEnum}"`);
    await queryRunner.dropSchema(this.schema, true, true);
  }
}
