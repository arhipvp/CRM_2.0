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
    permissionsSync: {
      name: string;
      jobTtlSeconds: number;
    };
  };
  storage: {
    root: string;
    quotaMb?: number | null;
    publicBaseUrl?: string | null;
    uploadBaseUrl: string;
    uploadTtlSeconds: number;
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

const toNumberOrNull = (value?: string): number | null => {
  if (value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    permissionsSync: {
      name: process.env.DOCUMENTS_PERMISSIONS_SYNC_QUEUE_NAME ?? 'documents.permissions.sync',
      jobTtlSeconds: Number(process.env.DOCUMENTS_PERMISSIONS_SYNC_JOB_TTL ?? 300),
    },
  },
  storage: {
    root: process.env.DOCUMENTS_STORAGE_ROOT ?? join(process.cwd(), 'var/documents'),
    quotaMb: toNumberOrNull(process.env.DOCUMENTS_STORAGE_QUOTA_MB),
    publicBaseUrl: process.env.DOCUMENTS_STORAGE_PUBLIC_BASE_URL ?? null,
    uploadBaseUrl: process.env.DOCUMENTS_UPLOAD_URL_BASE ?? 'https://storage.local/documents/upload',
    uploadTtlSeconds: Number(process.env.DOCUMENTS_UPLOAD_URL_TTL ?? 900),
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
      process.env.DOCUMENTS_FOLDERS_WEB_BASE_URL ?? 'https://files.local/documents/',
  },
});
