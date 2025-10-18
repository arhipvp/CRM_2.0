import { registerAs } from '@nestjs/config';

export type UpstreamTarget = 'crm' | 'auth' | 'notifications';

export interface UpstreamServiceConfig {
  baseUrl: string;
  timeout: number;
  serviceName?: string;
  sse?: {
    url: string;
  };
}

export interface UpstreamsConfig {
  defaultTimeout: number;
  reconnectDelay: number;
  heartbeatInterval: number;
  heartbeatTtl: number;
  services: Record<UpstreamTarget, UpstreamServiceConfig>;
}

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && !Number.isNaN(parsed) ? parsed : fallback;
};

const normalizeUrl = (url: string, defaultValue: string): string => {
  if (!url) {
    return defaultValue;
  }

  return url.replace(/\/$/, '');
};

export default registerAs('upstreams', (): UpstreamsConfig => {
  const defaultTimeout = parseNumber(process.env.GATEWAY_UPSTREAM_TIMEOUT, 5000);
  const reconnectDelay = parseNumber(process.env.GATEWAY_UPSTREAM_SSE_RECONNECT_DELAY, 3000);
  const heartbeatInterval = parseNumber(process.env.GATEWAY_UPSTREAM_SSE_HEARTBEAT_INTERVAL, 15000);
  const heartbeatTtl = parseNumber(process.env.GATEWAY_UPSTREAM_SSE_HEARTBEAT_TTL, 60);

  const crmBase = normalizeUrl(
    process.env.GATEWAY_UPSTREAM_CRM_BASE_URL ?? '',
    'http://localhost:8082/api'
  );
  const authBase = normalizeUrl(
    process.env.GATEWAY_UPSTREAM_AUTH_BASE_URL ?? '',
    'http://localhost:8081/api'
  );
  const notificationsBase = normalizeUrl(
    process.env.GATEWAY_UPSTREAM_NOTIFICATIONS_BASE_URL ?? '',
    'http://localhost:8085/api'
  );

  const crmSseUrl = normalizeUrl(
    process.env.GATEWAY_UPSTREAM_CRM_SSE_URL ?? '',
    'http://localhost:8082/streams'
  );

  return {
    defaultTimeout,
    reconnectDelay,
    heartbeatInterval,
    heartbeatTtl,
    services: {
      crm: {
        baseUrl: crmBase,
        timeout: parseNumber(process.env.GATEWAY_UPSTREAM_CRM_TIMEOUT, defaultTimeout),
        serviceName: process.env.GATEWAY_UPSTREAM_CRM_SERVICE_NAME ?? 'crm-service',
        sse: {
          url:
            process.env.GATEWAY_UPSTREAM_CRM_SSE_URL ?? normalizeUrl(`${crmBase}/streams`, 'http://localhost:8082/streams')
        }
      },
      auth: {
        baseUrl: authBase,
        timeout: parseNumber(process.env.GATEWAY_UPSTREAM_AUTH_TIMEOUT, defaultTimeout),
        serviceName: process.env.GATEWAY_UPSTREAM_AUTH_SERVICE_NAME ?? 'auth-service'
      },
      notifications: {
        baseUrl: notificationsBase,
        timeout: parseNumber(process.env.GATEWAY_UPSTREAM_NOTIFICATIONS_TIMEOUT, defaultTimeout),
        serviceName: process.env.GATEWAY_UPSTREAM_NOTIFICATIONS_SERVICE_NAME ?? 'notifications-service',
        sse: {
          url:
            process.env.GATEWAY_UPSTREAM_NOTIFICATIONS_SSE_URL ??
            normalizeUrl(`${notificationsBase}/streams`, 'http://localhost:8085/streams')
        }
      }
    }
  };
});
