import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreatePermissionsSyncTasks1740801600000 implements MigrationInterface {
  private readonly schema = process.env.DOCUMENTS_DATABASE_SCHEMA ?? 'documents';
  private readonly tableName = `${this.schema}.permissions_sync_tasks`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
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
          { name: 'folder_path', type: 'varchar', length: '1024', isNullable: false },
          { name: 'job_id', type: 'varchar', length: '255', isNullable: false },
          { name: 'users', type: 'jsonb', isNullable: false },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndices(this.tableName, [
      new TableIndex({ name: 'permissions_sync_tasks_job_idx', columnNames: ['job_id'] }),
      new TableIndex({
        name: 'permissions_sync_tasks_owner_idx',
        columnNames: ['owner_type', 'owner_id'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(this.tableName, 'permissions_sync_tasks_owner_idx');
    await queryRunner.dropIndex(this.tableName, 'permissions_sync_tasks_job_idx');
    await queryRunner.dropTable(this.tableName, true);
  }
}
