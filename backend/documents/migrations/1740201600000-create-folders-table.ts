import { MigrationInterface, QueryRunner, Table, TableIndex, TableUnique } from 'typeorm';

export class CreateFoldersTable1740201600000 implements MigrationInterface {
  private readonly schema = process.env.DOCUMENTS_DATABASE_SCHEMA ?? 'documents';
  private readonly tableName = `${this.schema}.folders`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: this.tableName,
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'owner_type', type: 'varchar', length: '32', isNullable: false },
          { name: 'owner_id', type: 'uuid', isNullable: false },
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
          { name: 'drive_folder_id', type: 'varchar', length: '255', isNullable: false },
          { name: 'parent_folder_id', type: 'varchar', length: '255', isNullable: true },
          { name: 'web_link', type: 'varchar', length: '1024', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createUniqueConstraint(
      this.tableName,
      new TableUnique({ name: 'folders_owner_idx', columnNames: ['owner_type', 'owner_id'] }),
    );

    await queryRunner.createIndices(this.tableName, [
      new TableIndex({ name: 'folders_drive_folder_id_idx', columnNames: ['drive_folder_id'] }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(this.tableName, 'folders_drive_folder_id_idx');
    await queryRunner.dropUniqueConstraint(this.tableName, 'folders_owner_idx');
    await queryRunner.dropTable(this.tableName, true);
  }
}
