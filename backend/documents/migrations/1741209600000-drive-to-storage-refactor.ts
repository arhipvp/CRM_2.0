import { MigrationInterface, QueryRunner } from 'typeorm';

export class DriveToStorageRefactor1741209600000 implements MigrationInterface {
  private readonly schema = process.env.DOCUMENTS_DATABASE_SCHEMA ?? 'documents';
  private readonly documentsTable = `${this.schema}.documents`;
  private readonly foldersTable = `${this.schema}.folders`;
  private readonly permissionsTable = `${this.schema}.permissions_sync_tasks`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(this.documentsTable)) {
      if (await queryRunner.hasColumn(this.documentsTable, 'drive_file_id')) {
        await queryRunner.renameColumn(this.documentsTable, 'drive_file_id', 'storage_path');
      }
      await queryRunner.query(
        `ALTER TABLE ${this.documentsTable} ALTER COLUMN storage_path TYPE varchar(2048);`,
      );
      if (!(await queryRunner.hasColumn(this.documentsTable, 'public_url'))) {
        await queryRunner.query(`ALTER TABLE ${this.documentsTable} ADD COLUMN public_url varchar(2048);`);
      }
      if (await queryRunner.hasColumn(this.documentsTable, 'drive_revision_id')) {
        await queryRunner.query(`ALTER TABLE ${this.documentsTable} DROP COLUMN drive_revision_id;`);
      }
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_indexes WHERE schemaname = '${this.schema}' AND indexname = 'documents_drive_file_id_idx'
          ) THEN
            ALTER INDEX ${this.schema}.documents_drive_file_id_idx RENAME TO documents_storage_path_idx;
          END IF;
        END;
        $$;
      `);
    }

    if (await queryRunner.hasTable(this.foldersTable)) {
      if (await queryRunner.hasColumn(this.foldersTable, 'drive_folder_id')) {
        await queryRunner.renameColumn(this.foldersTable, 'drive_folder_id', 'storage_path');
      }
      await queryRunner.query(
        `ALTER TABLE ${this.foldersTable} ALTER COLUMN storage_path TYPE varchar(1024);`,
      );
      if (await queryRunner.hasColumn(this.foldersTable, 'parent_folder_id')) {
        await queryRunner.renameColumn(this.foldersTable, 'parent_folder_id', 'parent_path');
      }
      await queryRunner.query(
        `ALTER TABLE ${this.foldersTable} ALTER COLUMN parent_path TYPE varchar(1024);`,
      );
      if (await queryRunner.hasColumn(this.foldersTable, 'web_link')) {
        await queryRunner.renameColumn(this.foldersTable, 'web_link', 'public_url');
      }
      await queryRunner.query(
        `ALTER TABLE ${this.foldersTable} ALTER COLUMN public_url TYPE varchar(2048);`,
      );
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_indexes WHERE schemaname = '${this.schema}' AND indexname = 'folders_drive_folder_id_idx'
          ) THEN
            ALTER INDEX ${this.schema}.folders_drive_folder_id_idx RENAME TO folders_storage_path_idx;
          END IF;
        END;
        $$;
      `);
    }

    if (await queryRunner.hasTable(this.permissionsTable)) {
      if (await queryRunner.hasColumn(this.permissionsTable, 'drive_folder_id')) {
        await queryRunner.renameColumn(this.permissionsTable, 'drive_folder_id', 'folder_path');
      }
      await queryRunner.query(
        `ALTER TABLE ${this.permissionsTable} ALTER COLUMN folder_path TYPE varchar(1024);`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(this.permissionsTable)) {
      await queryRunner.query(
        `ALTER TABLE ${this.permissionsTable} ALTER COLUMN folder_path TYPE varchar(255);`,
      );
      if (await queryRunner.hasColumn(this.permissionsTable, 'folder_path')) {
        await queryRunner.renameColumn(this.permissionsTable, 'folder_path', 'drive_folder_id');
      }
    }

    if (await queryRunner.hasTable(this.foldersTable)) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_indexes WHERE schemaname = '${this.schema}' AND indexname = 'folders_storage_path_idx'
          ) THEN
            ALTER INDEX ${this.schema}.folders_storage_path_idx RENAME TO folders_drive_folder_id_idx;
          END IF;
        END;
        $$;
      `);
      await queryRunner.query(
        `ALTER TABLE ${this.foldersTable} ALTER COLUMN public_url TYPE varchar(1024);`,
      );
      if (await queryRunner.hasColumn(this.foldersTable, 'public_url')) {
        await queryRunner.renameColumn(this.foldersTable, 'public_url', 'web_link');
      }
      await queryRunner.query(
        `ALTER TABLE ${this.foldersTable} ALTER COLUMN parent_path TYPE varchar(255);`,
      );
      if (await queryRunner.hasColumn(this.foldersTable, 'parent_path')) {
        await queryRunner.renameColumn(this.foldersTable, 'parent_path', 'parent_folder_id');
      }
      await queryRunner.query(
        `ALTER TABLE ${this.foldersTable} ALTER COLUMN storage_path TYPE varchar(255);`,
      );
      if (await queryRunner.hasColumn(this.foldersTable, 'storage_path')) {
        await queryRunner.renameColumn(this.foldersTable, 'storage_path', 'drive_folder_id');
      }
    }

    if (await queryRunner.hasTable(this.documentsTable)) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_indexes WHERE schemaname = '${this.schema}' AND indexname = 'documents_storage_path_idx'
          ) THEN
            ALTER INDEX ${this.schema}.documents_storage_path_idx RENAME TO documents_drive_file_id_idx;
          END IF;
        END;
        $$;
      `);
      await queryRunner.query(
        `ALTER TABLE ${this.documentsTable} ALTER COLUMN storage_path TYPE varchar;`,
      );
      if (await queryRunner.hasColumn(this.documentsTable, 'storage_path')) {
        await queryRunner.renameColumn(this.documentsTable, 'storage_path', 'drive_file_id');
      }
      if (await queryRunner.hasColumn(this.documentsTable, 'public_url')) {
        await queryRunner.query(`ALTER TABLE ${this.documentsTable} DROP COLUMN public_url;`);
      }
      if (!(await queryRunner.hasColumn(this.documentsTable, 'drive_revision_id'))) {
        await queryRunner.query(`ALTER TABLE ${this.documentsTable} ADD COLUMN drive_revision_id varchar;`);
      }
    }
  }
}
