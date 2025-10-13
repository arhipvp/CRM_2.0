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
    eventsQueue: string;
    eventsRoutingKey: string;
  };
  redis: {
    url: string;
    delayedQueueKey: string;
  };
  scheduling: {
    workerEnabled: boolean;
    pollIntervalMs: number;
    batchSize: number;
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
    eventsQueue: process.env.TASKS_EVENTS_QUEUE ?? 'tasks.events',
    eventsRoutingKey: process.env.TASKS_EVENTS_ROUTING_KEY ?? 'tasks.event'
  },
  redis: {
    url: process.env.TASKS_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379/6',
    delayedQueueKey: process.env.TASKS_DELAYED_QUEUE_KEY ?? 'tasks:delayed'
  },
  scheduling: {
    workerEnabled: (process.env.TASKS_WORKER_ENABLED ?? 'false').toLowerCase() === 'true',
    pollIntervalMs: parseInt(process.env.TASKS_WORKER_POLL_INTERVAL_MS ?? '5000', 10),
    batchSize: parseInt(process.env.TASKS_WORKER_BATCH_SIZE ?? '100', 10)
  }
}));
