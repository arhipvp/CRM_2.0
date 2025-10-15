import { registerAs } from '@nestjs/config';

type TasksConfiguration = {
  service: {
    port: number;
    host: string;
  };
  database: {
    url: string;
    logging: boolean;
  };
  rabbitmq: {
    url: string;
    eventsExchange: string;
    events: {
      exchange: string;
      source: string;
      routingKeys: {
        taskCreated: string;
        taskStatusChanged: string;
        taskReminder: string;
      };
    };
  };
  redis: {
    url: string;
    delayedQueueKey: string;
    remindersQueueKey: string;
  };
  scheduling: {
    workerEnabled: boolean;
    pollIntervalMs: number;
    batchSize: number;
  };
  reminders: {
    pollIntervalMs: number;
  };
};

export default registerAs('tasks', (): TasksConfiguration => ({
  service: {
    port: parseInt(process.env.TASKS_SERVICE_PORT ?? '8086', 10),
    host: process.env.TASKS_SERVICE_HOST ?? '0.0.0.0'
  },
  database: {
    url: process.env.TASKS_DATABASE_URL ?? '',
    logging: (process.env.TASKS_TYPEORM_LOGGING ?? 'false').toLowerCase() === 'true'
  },
  rabbitmq: {
    url: process.env.TASKS_RABBITMQ_URL ?? process.env.RABBITMQ_URL ?? '',
    eventsExchange: process.env.TASKS_EVENTS_EXCHANGE ?? 'tasks.events',
    events: {
      exchange: process.env.TASKS_EVENTS_EXCHANGE ?? 'tasks.events',
      source: process.env.TASKS_EVENTS_SOURCE ?? 'tasks.service',
      routingKeys: {
        taskCreated: process.env.TASKS_EVENTS_TASK_CREATED_KEY ?? 'task.created',
        taskStatusChanged:
          process.env.TASKS_EVENTS_STATUS_CHANGED_KEY ?? 'task.status.changed',
        taskReminder: process.env.TASKS_EVENTS_REMINDER_KEY ?? 'task.reminder'
      }
    }
  },
  redis: {
    url: process.env.TASKS_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379/6',
    delayedQueueKey: process.env.TASKS_DELAYED_QUEUE_KEY ?? 'tasks:delayed',
    remindersQueueKey: process.env.TASKS_REMINDERS_QUEUE_KEY ?? 'tasks:reminders'
  },
  scheduling: {
    workerEnabled: (process.env.TASKS_WORKER_ENABLED ?? 'false').toLowerCase() === 'true',
    pollIntervalMs: parseInt(process.env.TASKS_WORKER_POLL_INTERVAL_MS ?? '5000', 10),
    batchSize: parseInt(process.env.TASKS_WORKER_BATCH_SIZE ?? '100', 10)
  },
  reminders: {
    pollIntervalMs: parseInt(process.env.TASKS_REMINDERS_POLL_INTERVAL_MS ?? '5000', 10)
  }
}));
