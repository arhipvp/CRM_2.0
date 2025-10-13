import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NOTIFICATIONS_HTTP_HOST: Joi.string().default('0.0.0.0'),
  NOTIFICATIONS_HTTP_PORT: Joi.number().port().default(3050),

  NOTIFICATIONS_DB_HOST: Joi.string().hostname().default('localhost'),
  NOTIFICATIONS_DB_PORT: Joi.number().port().default(5432),
  NOTIFICATIONS_DB_USER: Joi.string().default('notifications'),
  NOTIFICATIONS_DB_PASSWORD: Joi.string().allow('').default('notifications'),
  NOTIFICATIONS_DB_NAME: Joi.string().default('notifications'),
  NOTIFICATIONS_DB_SSL: Joi.boolean().default(false),

  NOTIFICATIONS_RABBITMQ_URI: Joi.string().uri({ scheme: [/amqp/] }).default('amqp://guest:guest@localhost:5672'),
  NOTIFICATIONS_RABBITMQ_URL: Joi.string().uri({ scheme: [/amqp/] }).optional(),
  NOTIFICATIONS_RABBITMQ_EXCHANGE: Joi.string().default('notifications.exchange'),
  NOTIFICATIONS_RABBITMQ_QUEUE: Joi.string().default('notifications.events'),
  NOTIFICATIONS_RABBITMQ_ROUTING_KEY: Joi.string().default('notifications.*'),
  NOTIFICATIONS_RABBITMQ_QUEUE_DURABLE: Joi.boolean().default(true),

  NOTIFICATIONS_DISPATCH_EXCHANGE: Joi.string().optional(),
  NOTIFICATIONS_DISPATCH_ROUTING_KEY: Joi.string().default('notifications.dispatch'),
  NOTIFICATIONS_DISPATCH_REDIS_CHANNEL: Joi.string().default('notifications:dispatch'),
  NOTIFICATIONS_DISPATCH_RETRY_ATTEMPTS: Joi.number().integer().min(1).default(3),
  NOTIFICATIONS_DISPATCH_RETRY_DELAY_MS: Joi.number().integer().min(0).default(60000),

  NOTIFICATIONS_REDIS_HOST: Joi.string().default('localhost'),
  NOTIFICATIONS_REDIS_PORT: Joi.number().port().default(6379),
  NOTIFICATIONS_REDIS_USERNAME: Joi.string().allow('').optional(),
  NOTIFICATIONS_REDIS_PASSWORD: Joi.string().allow('').optional(),
  NOTIFICATIONS_REDIS_DB: Joi.number().integer().min(0).default(0),
  NOTIFICATIONS_REDIS_PREFIX: Joi.string().default('notifications:'),

  NOTIFICATIONS_TELEGRAM_ENABLED: Joi.boolean().default(false),
  NOTIFICATIONS_TELEGRAM_MOCK: Joi.boolean().default(true),
  NOTIFICATIONS_TELEGRAM_BOT_TOKEN: Joi.string().allow('', null).default(null),
  NOTIFICATIONS_TELEGRAM_CHAT_ID: Joi.string().allow('', null).default(null),
  NOTIFICATIONS_TELEGRAM_WEBHOOK_ENABLED: Joi.boolean().default(false),
  NOTIFICATIONS_TELEGRAM_WEBHOOK_SECRET: Joi.string().allow('', null).default(null),
  NOTIFICATIONS_TELEGRAM_WEBHOOK_SIGNATURE_HEADER: Joi.string()
    .default('x-telegram-signature')
    .pattern(/^[a-z0-9\-]+$/i),

  NOTIFICATIONS_SSE_RETRY_MS: Joi.number().integer().min(0).default(5000),

  NOTIFICATIONS_TEMPLATES_DEFAULT_LOCALE: Joi.string().default('ru-RU')
});
