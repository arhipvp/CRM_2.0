import { DataSource } from 'typeorm';
import configuration from './src/config/configuration';

const config = configuration();

export default new DataSource({
  type: 'postgres',
  host: process.env.NOTIFICATIONS_DB_HOST ?? config.postgres.host,
  port: Number(process.env.NOTIFICATIONS_DB_PORT ?? config.postgres.port),
  username: process.env.NOTIFICATIONS_DB_USER ?? config.postgres.user,
  password: process.env.NOTIFICATIONS_DB_PASSWORD ?? config.postgres.password,
  database: process.env.NOTIFICATIONS_DB_NAME ?? config.postgres.database,
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['migrations/*{.ts,.js}'],
  migrationsTableName: 'notifications_migrations'
});
