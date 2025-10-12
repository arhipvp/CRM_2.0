import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  url: string;
  keyPrefix: string;
  cacheTtl: number;
  heartbeatPrefix: string;
}

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && !Number.isNaN(parsed) ? parsed : fallback;
};

export default registerAs('redis', (): RedisConfig => {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379/0';

  return {
    url,
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'gateway',
    cacheTtl: parseNumber(process.env.REDIS_CACHE_TTL, 300),
    heartbeatPrefix: process.env.REDIS_HEARTBEAT_PREFIX ?? 'gateway:sse'
  };
});
