import { join } from 'path';

export interface DocumentsConfiguration {
  port: number;
  database: {
    url: string;
    schema: string;
    runMigrations: boolean;
  };
  redis: {
    url: string;
    prefix: string;
  };
  queues: {
    documents: string;
  };
  drive: {
    serviceAccountJson?: string;
    sharedDriveId?: string;
    emulatorUrl?: string;
    emulatorRoot?: string;
    credentialsPath?: string;
  };
  folders: {
    templates: {
      default: string;
      client: string;
      deal: string;
      policy: string;
      payment: string;
    };
    webBaseUrl: string;
  };
}

const toBoolean = (value?: string, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
};

export default (): DocumentsConfiguration => ({
  port: Number(process.env.DOCUMENTS_SERVICE_PORT ?? 8084),
  database: {
    url: process.env.DOCUMENTS_DATABASE_URL ?? '',
    schema: process.env.DOCUMENTS_DATABASE_SCHEMA ?? 'documents',
    runMigrations: toBoolean(process.env.DOCUMENTS_RUN_MIGRATIONS, false),
  },
  redis: {
    url: process.env.DOCUMENTS_REDIS_URL ?? '',
    prefix: process.env.DOCUMENTS_REDIS_PREFIX ?? 'documents',
  },
  queues: {
    documents: process.env.DOCUMENTS_QUEUE_NAME ?? 'documents:tasks',
  },
  drive: {
    serviceAccountJson: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON,
    sharedDriveId: process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID,
    emulatorUrl: process.env.GOOGLE_DRIVE_EMULATOR_URL,
    emulatorRoot: process.env.GOOGLE_DRIVE_EMULATOR_ROOT,
    credentialsPath:
      process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH ??
      process.env.GOOGLE_APPLICATION_CREDENTIALS ??
      join(process.cwd(), 'credentials/service-account.json'),
  },
  folders: {
    templates: {
      default: process.env.DOCUMENTS_FOLDERS_TEMPLATE_DEFAULT ?? '{title}',
      client: process.env.DOCUMENTS_FOLDERS_TEMPLATE_CLIENT ?? 'Client {ownerId}',
      deal: process.env.DOCUMENTS_FOLDERS_TEMPLATE_DEAL ?? 'Deal {ownerId}',
      policy: process.env.DOCUMENTS_FOLDERS_TEMPLATE_POLICY ?? 'Policy {ownerId}',
      payment: process.env.DOCUMENTS_FOLDERS_TEMPLATE_PAYMENT ?? 'Payment {ownerId}',
    },
    webBaseUrl:
      process.env.DOCUMENTS_FOLDERS_WEB_BASE_URL ?? 'https://drive.google.com/drive/folders/',
  },
});
