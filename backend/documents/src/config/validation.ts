import * as Joi from 'joi';

export const validationSchema = Joi.object({
  DOCUMENTS_SERVICE_PORT: Joi.number().port().default(8084),
  DOCUMENTS_DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  DOCUMENTS_DATABASE_SCHEMA: Joi.string().default('documents'),
  DOCUMENTS_RUN_MIGRATIONS: Joi.boolean().default(false),
  DOCUMENTS_REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).required(),
  DOCUMENTS_REDIS_PREFIX: Joi.string().default('documents'),
  DOCUMENTS_QUEUE_NAME: Joi.string().default('documents_tasks'),
  DOCUMENTS_PERMISSIONS_SYNC_QUEUE_NAME: Joi.string().default('documents.permissions.sync'),
  DOCUMENTS_PERMISSIONS_SYNC_JOB_TTL: Joi.number().integer().min(60).default(300),
  DOCUMENTS_STORAGE_ROOT: Joi.string().default('./var/documents'),
  DOCUMENTS_STORAGE_QUOTA_MB: Joi.alternatives()
    .try(Joi.number().integer().min(0), Joi.string().valid(''))
    .optional(),
  DOCUMENTS_STORAGE_PUBLIC_BASE_URL: Joi.string().uri({ scheme: [/https?/] }).allow(null, '').optional(),
  DOCUMENTS_UPLOAD_URL_BASE: Joi.string().uri({ scheme: [/https?/] }).required(),
  DOCUMENTS_UPLOAD_URL_TTL: Joi.number().integer().min(60).default(900),
  DOCUMENTS_FOLDERS_TEMPLATE_DEFAULT: Joi.string().default('{title}'),
  DOCUMENTS_FOLDERS_TEMPLATE_CLIENT: Joi.string().default('Client {ownerId}'),
  DOCUMENTS_FOLDERS_TEMPLATE_DEAL: Joi.string().default('Deal {ownerId}'),
  DOCUMENTS_FOLDERS_TEMPLATE_POLICY: Joi.string().default('Policy {ownerId}'),
  DOCUMENTS_FOLDERS_TEMPLATE_PAYMENT: Joi.string().default('Payment {ownerId}'),
  DOCUMENTS_FOLDERS_WEB_BASE_URL: Joi.string()
    .uri({ scheme: [/https?/] })
    .default('https://files.local/documents/'),
});
