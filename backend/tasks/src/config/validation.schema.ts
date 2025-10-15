import * as Joi from 'joi';

export const validationSchema = Joi.object({
  TASKS_SERVICE_PORT: Joi.number().port().default(8086),
  TASKS_SERVICE_HOST: Joi.string().hostname().default('0.0.0.0'),
  TASKS_DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  TASKS_TYPEORM_LOGGING: Joi.boolean().default(false),
  TASKS_RABBITMQ_URL: Joi.string().uri({ scheme: ['amqp', 'amqps'] }).required(),
  TASKS_EVENTS_EXCHANGE: Joi.string().default('tasks.events'),
  TASKS_EVENTS_SOURCE: Joi.string().default('tasks.service'),
  TASKS_EVENTS_TASK_CREATED_KEY: Joi.string().default('task.created'),
  TASKS_EVENTS_STATUS_CHANGED_KEY: Joi.string().default('task.status.changed'),
  TASKS_EVENTS_REMINDER_KEY: Joi.string().default('task.reminder'),
  TASKS_REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).optional(),
  TASKS_DELAYED_QUEUE_KEY: Joi.string().default('tasks:delayed'),
  TASKS_REMINDERS_POLL_INTERVAL_MS: Joi.number().min(500).default(5000),
  TASKS_WORKER_ENABLED: Joi.boolean().default(false),
  TASKS_WORKER_POLL_INTERVAL_MS: Joi.number().min(500).default(5000),
  TASKS_WORKER_BATCH_SIZE: Joi.number().min(1).max(5000).default(100)
});
