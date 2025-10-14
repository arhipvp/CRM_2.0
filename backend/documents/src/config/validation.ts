import * as Joi from 'joi';

export const validationSchema = Joi.object({
  DOCUMENTS_SERVICE_PORT: Joi.number().port().default(8084),
  DOCUMENTS_DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  DOCUMENTS_DATABASE_SCHEMA: Joi.string().default('documents'),
  DOCUMENTS_RUN_MIGRATIONS: Joi.boolean().default(false),
  DOCUMENTS_REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).required(),
  DOCUMENTS_REDIS_PREFIX: Joi.string().default('documents'),
  DOCUMENTS_QUEUE_NAME: Joi.string().default('documents:tasks'),
  GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: Joi.string().optional(),
  GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH: Joi.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: Joi.string().optional(),
  GOOGLE_DRIVE_SHARED_DRIVE_ID: Joi.string().optional(),
  GOOGLE_DRIVE_EMULATOR_URL: Joi.string().uri({ scheme: [/https?/] }).optional(),
  GOOGLE_DRIVE_EMULATOR_ROOT: Joi.string().optional(),
  DOCUMENTS_FOLDERS_TEMPLATE_DEFAULT: Joi.string().default('{title}'),
  DOCUMENTS_FOLDERS_TEMPLATE_CLIENT: Joi.string().default('Client {ownerId}'),
  DOCUMENTS_FOLDERS_TEMPLATE_DEAL: Joi.string().default('Deal {ownerId}'),
  DOCUMENTS_FOLDERS_TEMPLATE_POLICY: Joi.string().default('Policy {ownerId}'),
  DOCUMENTS_FOLDERS_TEMPLATE_PAYMENT: Joi.string().default('Payment {ownerId}'),
  DOCUMENTS_FOLDERS_WEB_BASE_URL: Joi.string()
    .uri({ scheme: [/https?/] })
    .default('https://drive.google.com/drive/folders/'),
});
