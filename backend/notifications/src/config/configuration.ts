import { config as loadEnv } from 'dotenv';

loadEnv();

type BooleanLike = string | number | boolean | undefined;

const toBool = (value: BooleanLike, fallback: boolean) => {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
};

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export interface NotificationsConfiguration {
  http: {
    host: string;
    port: number;
  };
  postgres: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl: boolean;
  };
  rabbitmq: {
    uri: string;
    exchange: string;
    queue: string;
    routingKey: string;
    outgoingRoutingKey: string;
    queueOptions: {
      durable: boolean;
    };
  };
  redis: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db: number;
    keyPrefix: string;
    notificationsChannel: string;
  };
  telegram: {
    enabled: boolean;
    mock: boolean;
    botToken: string | null;
    defaultChatId: string | null;
  };
  sse: {
    retryInterval: number;
  };
  delivery: {
    maxAttempts: number;
    retryDelayMs: number;
  };
}

export default (): NotificationsConfiguration => {
  const host = process.env.NOTIFICATIONS_HTTP_HOST ?? '0.0.0.0';
  const port = toNumber(process.env.NOTIFICATIONS_HTTP_PORT, 3050);

  return {
    http: {
      host,
      port
    },
    postgres: {
      host: process.env.NOTIFICATIONS_DB_HOST ?? 'localhost',
      port: toNumber(process.env.NOTIFICATIONS_DB_PORT, 5432),
      user: process.env.NOTIFICATIONS_DB_USER ?? 'notifications',
      password: process.env.NOTIFICATIONS_DB_PASSWORD ?? 'notifications',
      database: process.env.NOTIFICATIONS_DB_NAME ?? 'notifications',
      ssl: toBool(process.env.NOTIFICATIONS_DB_SSL, false)
    },
    rabbitmq: {
      uri:
        process.env.NOTIFICATIONS_RABBITMQ_URI ??
        process.env.NOTIFICATIONS_RABBITMQ_URL ??
        'amqp://guest:guest@localhost:5672',
      exchange: process.env.NOTIFICATIONS_RABBITMQ_EXCHANGE ?? 'notifications.exchange',
      queue: process.env.NOTIFICATIONS_RABBITMQ_QUEUE ?? 'notifications.events',
      routingKey: process.env.NOTIFICATIONS_RABBITMQ_ROUTING_KEY ?? 'notifications.*',
      outgoingRoutingKey:
        process.env.NOTIFICATIONS_RABBITMQ_OUTGOING_ROUTING_KEY ?? 'notifications.created',
      queueOptions: {
        durable: toBool(process.env.NOTIFICATIONS_RABBITMQ_QUEUE_DURABLE, true)
      }
    },
    redis: {
      host: process.env.NOTIFICATIONS_REDIS_HOST ?? 'localhost',
      port: toNumber(process.env.NOTIFICATIONS_REDIS_PORT, 6379),
      username: process.env.NOTIFICATIONS_REDIS_USERNAME ?? undefined,
      password: process.env.NOTIFICATIONS_REDIS_PASSWORD ?? undefined,
      db: toNumber(process.env.NOTIFICATIONS_REDIS_DB, 0),
      keyPrefix: process.env.NOTIFICATIONS_REDIS_PREFIX ?? 'notifications:',
      notificationsChannel:
        process.env.NOTIFICATIONS_REDIS_NOTIFICATIONS_CHANNEL ?? 'notifications:events'
    },
    telegram: {
      enabled: toBool(process.env.NOTIFICATIONS_TELEGRAM_ENABLED, false),
      mock: toBool(process.env.NOTIFICATIONS_TELEGRAM_MOCK, true),
      botToken: process.env.NOTIFICATIONS_TELEGRAM_BOT_TOKEN ?? null,
      defaultChatId: process.env.NOTIFICATIONS_TELEGRAM_CHAT_ID ?? null
    },
    sse: {
      retryInterval: toNumber(process.env.NOTIFICATIONS_SSE_RETRY_MS, 5000)
    },
    delivery: {
      maxAttempts: toNumber(process.env.NOTIFICATIONS_DELIVERY_MAX_ATTEMPTS, 3),
      retryDelayMs: toNumber(process.env.NOTIFICATIONS_DELIVERY_RETRY_DELAY_MS, 30000)
    }
  };
};
