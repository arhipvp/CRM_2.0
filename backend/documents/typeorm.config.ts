import 'dotenv/config';

import { DataSource } from 'typeorm';

import configuration from './src/config/configuration';
import { DocumentEntity } from './src/documents/document.entity';

const config = configuration();

const DocumentsDataSource = new DataSource({
  type: 'postgres',
  url: config.database.url,
  schema: config.database.schema,
  entities: [DocumentEntity],
  migrations: ['migrations/*.{ts,js}'],
  migrationsTableName: 'documents_migrations',
  synchronize: false,
});

export default DocumentsDataSource;
