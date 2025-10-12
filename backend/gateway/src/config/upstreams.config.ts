import { registerAs } from '@nestjs/config';

export type UpstreamTarget = 'crm' | 'payments' | 'auth' | 'notifications';

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
    'http://localhost:3001/api'
  );
  const paymentsBase = normalizeUrl(
    process.env.GATEWAY_UPSTREAM_PAYMENTS_BASE_URL ?? '',
    'http://localhost:3003/api'
  );
  const paymentsStreamsDefault = `http://localhost:${process.env.PAYMENTS_SERVICE_PORT ?? '8083'}/streams`;
  const authBase = normalizeUrl(
    process.env.GATEWAY_UPSTREAM_AUTH_BASE_URL ?? '',
    'http://localhost:3005/api'
  );
  const notificationsBase = normalizeUrl(
    process.env.GATEWAY_UPSTREAM_NOTIFICATIONS_BASE_URL ?? '',
    'http://localhost:3011/api'
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
            process.env.GATEWAY_UPSTREAM_CRM_SSE_URL ?? normalizeUrl(`${crmBase}/streams`, 'http://localhost:3001/streams')
        }
      },
      payments: {
        baseUrl: paymentsBase,
        timeout: parseNumber(process.env.GATEWAY_UPSTREAM_PAYMENTS_TIMEOUT, defaultTimeout),
        serviceName: process.env.GATEWAY_UPSTREAM_PAYMENTS_SERVICE_NAME ?? 'payments-service',
        sse: {
          url:
            process.env.GATEWAY_UPSTREAM_PAYMENTS_SSE_URL ??
            normalizeUrl(`${paymentsBase}/streams`, paymentsStreamsDefault)
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
            normalizeUrl(`${notificationsBase}/streams`, 'http://localhost:3011/streams')
        }
      }
    }
  };
});
