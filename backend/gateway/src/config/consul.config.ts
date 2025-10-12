import { registerAs } from '@nestjs/config';

export interface ConsulConfig {
  enabled: boolean;
  scheme: 'http' | 'https';
  host: string;
  port: number;
  token?: string;
  dc?: string;
  timeout: number;
}

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && !Number.isNaN(parsed) ? parsed : fallback;
};

export default registerAs('consul', (): ConsulConfig => {
  const address = process.env.CONSUL_HTTP_ADDR ?? 'http://localhost:8500';
  const parsedUrl = new URL(address);

  return {
    enabled: (process.env.CONSUL_ENABLED ?? 'true').toLowerCase() !== 'false',
    scheme: parsedUrl.protocol === 'https:' ? 'https' : 'http',
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number.parseInt(parsedUrl.port, 10) : parsedUrl.protocol === 'https:' ? 443 : 8500,
    token: process.env.CONSUL_HTTP_TOKEN,
    dc: process.env.CONSUL_DC,
    timeout: parseNumber(process.env.CONSUL_HTTP_TIMEOUT, 5000)
  };
});
