import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { Readable } from 'stream';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, MessageEvent, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import RedisMock from 'ioredis-mock';

import { AppModule } from '../src/app.module';
import { REDIS_CLIENT } from '../src/integrations/redis/redis.constants';
import { UpstreamSseService } from '../src/sse/upstream-sse.service';
import type { Redis } from 'ioredis';
import type { HttpService } from '@nestjs/axios';
import type { ConfigService } from '@nestjs/config';
import type { RedisConfig } from '../src/config/redis.config';
import type { UpstreamsConfig } from '../src/config/upstreams.config';

async function readRequestBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (!chunks.length) {
    return undefined;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    return Buffer.concat(chunks).toString('utf-8');
  }
}

function createUpstreamServer(): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const { url = '', method = 'GET' } = req;

      if (url.startsWith('/crm')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            upstream: 'crm',
            method,
            url
          })
        );
        return;
      }

      if (url.startsWith('/payments')) {
        const body = await readRequestBody(req);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ upstream: 'payments', body }));
        return;
      }

      if (url.startsWith('/auth')) {
        const body = await readRequestBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ upstream: 'auth', body }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

describe('Gateway bootstrap', () => {
  let app: INestApplication;
  let upstreamServer: Server;
  let upstreamUrl: string;
  let redis: RedisMock;

  beforeAll(async () => {
    const upstream = await createUpstreamServer();
    upstreamServer = upstream.server;
    upstreamUrl = upstream.url;

    process.env.GATEWAY_UPSTREAM_CRM_BASE_URL = `${upstreamUrl}/crm`;
    process.env.GATEWAY_UPSTREAM_PAYMENTS_BASE_URL = `${upstreamUrl}/payments`;
    process.env.GATEWAY_UPSTREAM_AUTH_BASE_URL = `${upstreamUrl}/auth`;
    process.env.GATEWAY_UPSTREAM_NOTIFICATIONS_BASE_URL = `${upstreamUrl}/notifications`;
    process.env.CONSUL_ENABLED = 'false';
    process.env.REDIS_URL = 'mock://gateway';

    redis = new RedisMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue(redis)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve) => upstreamServer.close(() => resolve()));
  });

  it('responds to health check', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.details.redis.status).toBe('up');
    expect(response.body.details.consul.status).toBe('up');
  });

  it('proxies CRM requests with path and query', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/crm/customers/42?expand=profile');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ upstream: 'crm', url: expect.stringContaining('customers/42') });
  });

  it('proxies Payments POST requests and forwards body', async () => {
    const payload = { invoice: 'INV-001', amount: 1000 };
    const response = await request(app.getHttpServer())
      .post('/api/v1/payments/invoices')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ upstream: 'payments', body: payload });
  });
});

describe('UpstreamSseService', () => {
  let redis: Redis;
  let service: UpstreamSseService;
  let httpService: HttpService;
  let configService: ConfigService;

  beforeEach(() => {
    redis = new RedisMock();

    const upstreams: UpstreamsConfig = {
      defaultTimeout: 5000,
      reconnectDelay: 50,
      heartbeatInterval: 50,
      heartbeatTtl: 60,
      services: {
        crm: {
          baseUrl: 'http://crm',
          timeout: 5000,
          serviceName: 'crm-service',
          sse: { url: 'http://crm/streams' }
        },
        payments: {
          baseUrl: 'http://payments',
          timeout: 5000,
          serviceName: 'payments-service'
        },
        auth: {
          baseUrl: 'http://auth',
          timeout: 5000,
          serviceName: 'auth-service'
        },
        notifications: {
          baseUrl: 'http://notifications',
          timeout: 5000,
          serviceName: 'notifications-service',
          sse: { url: 'http://notifications/streams' }
        }
      }
    };

    const redisConfig: RedisConfig = {
      url: 'mock://gateway',
      keyPrefix: 'gateway',
      cacheTtl: 300,
      heartbeatPrefix: 'gateway:sse'
    };

    httpService = {
      axiosRef: {
        get: jest.fn()
      }
    } as unknown as HttpService;

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'upstreams') {
          return upstreams;
        }
        if (key === 'redis') {
          return redisConfig;
        }
        return undefined;
      })
    } as unknown as ConfigService;

    service = new UpstreamSseService(httpService, configService, redis);
  });

  afterEach(async () => {
    await redis.quit();
    jest.resetAllMocks();
  });

  it('emits upstream events and updates Redis heartbeat', async () => {
    const stream = new Readable({
      read() {
        this.push('id: 1\n');
        this.push('event: crm-update\n');
        this.push('data: {"source":"crm","value":1}\n\n');
        this.push(null);
      }
    });

    (httpService.axiosRef.get as jest.Mock).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
      data: stream
    });

    const events: MessageEvent[] = [];
    const subscription = service.stream('crm').subscribe({
      next: (event) => {
        events.push(event);
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    subscription.unsubscribe();

    const crmEvent = events.find((event) => event.type === 'crm-update');

    expect(crmEvent).toBeDefined();
    expect(crmEvent?.data).toBe('{"source":"crm","value":1}');
    expect(await redis.get('gateway:sse:crm')).toBeTruthy();
    expect(await redis.get('gateway:sse:crm:last-event-id')).toBe('1');
  });
});
