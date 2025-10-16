import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { Readable } from 'stream';
import { Observable } from 'rxjs';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, MessageEvent, VersioningType } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import RedisMock from 'ioredis-mock';

import { AppModule } from '../src/app.module';
import { REDIS_CLIENT } from '../src/integrations/redis/redis.constants';
import { UpstreamSseService } from '../src/sse/upstream-sse.service';
import { ConsulModule } from '../src/integrations/consul/consul.module';
import { CONSUL_CLIENT } from '../src/integrations/consul/consul.constants';
import consulConfig from '../src/config/consul.config';
import type { Redis } from 'ioredis';
import type { HttpService } from '@nestjs/axios';
import type { ConfigService } from '@nestjs/config';
import type { RedisConfig } from '../src/config/redis.config';
import type { UpstreamsConfig } from '../src/config/upstreams.config';
import type Consul from 'consul';

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
  let upstreamSseServiceMock: { stream: jest.Mock };

  beforeAll(async () => {
    const upstream = await createUpstreamServer();
    upstreamServer = upstream.server;
    upstreamUrl = upstream.url;

    process.env.GATEWAY_UPSTREAM_CRM_BASE_URL = `${upstreamUrl}/crm`;
    process.env.GATEWAY_UPSTREAM_AUTH_BASE_URL = `${upstreamUrl}/auth`;
    process.env.GATEWAY_UPSTREAM_NOTIFICATIONS_BASE_URL = `${upstreamUrl}/notifications`;
    process.env.CONSUL_ENABLED = 'false';
    process.env.REDIS_URL = 'mock://gateway';

    redis = new RedisMock();

    upstreamSseServiceMock = {
      stream: jest.fn((channel: string) =>
        new Observable<MessageEvent>((subscriber) => {
          subscriber.next({ data: { channel, marker: `${channel}-event` } });
          subscriber.complete();
        })
      )
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue(redis)
      .overrideProvider(UpstreamSseService)
      .useValue(upstreamSseServiceMock)
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

  it('exposes deals stream as an alias for CRM SSE', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/streams/deals')
      .set('Accept', 'text/event-stream')
      .buffer(true);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toContain('crm-event');
    expect(upstreamSseServiceMock.stream).toHaveBeenCalledWith('crm');
  });

  it('exposes deals SSE stream with correct headers', async () => {
    await new Promise<void>((resolve, reject) => {
      request(app.getHttpServer())
        .get('/api/v1/streams/deals')
        .set('Accept', 'text/event-stream')
        .buffer(false)
        .parse((res, callback) => {
          let finished = false;
          const finalize = () => {
            if (finished) {
              return;
            }
            finished = true;
            clearTimeout(timeout);
            callback(null, null);
          };
          const closeStream = () => {
            const stream = res as unknown as Readable & {
              req?: { abort?: () => void; destroy?: () => void };
            };

            if (typeof stream.destroy === 'function') {
              stream.destroy();
            } else if (stream.req?.destroy) {
              stream.req.destroy();
            } else {
              stream.req?.abort?.();
            }
          };
          const timeout = setTimeout(() => {
            closeStream();
            finalize();
          }, 500);

          res.on('data', () => {
            closeStream();
            finalize();
          });
          res.on('close', finalize);
          res.on('end', finalize);
          res.on('error', (error) => {
            if (finished) {
              return;
            }
            callback(error as Error, null);
          });
        })
        .end((err, res) => {
          if (err) {
            reject(err);
            return;
          }

          try {
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('text/event-stream');
            expect(res.headers['cache-control']).toContain('no-cache');
            expect(res.headers.connection).toBe('keep-alive');
            resolve();
          } catch (assertionError) {
            reject(assertionError);
          }
        });
    });
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

  it('subscribes to notifications stream when SSE is configured', async () => {
    const stream = new Readable({
      read() {
        this.push('id: 2\n');
        this.push('event: notification.created\n');
        this.push('data: {"source":"notifications","value":2}\n\n');
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
    const subscription = service.stream('notifications').subscribe({
      next: (event) => {
        events.push(event);
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    subscription.unsubscribe();

    expect(events.some((event) => event.type === 'notification.created')).toBe(true);
    expect(await redis.get('gateway:sse:notifications')).toBeTruthy();
    expect(await redis.get('gateway:sse:notifications:last-event-id')).toBe('2');
  });
});

describe('ConsulModule', () => {
  let moduleRef: TestingModule;
  let originalEnabled: string | undefined;
  let originalAddr: string | undefined;

  beforeAll(async () => {
    originalEnabled = process.env.CONSUL_ENABLED;
    originalAddr = process.env.CONSUL_HTTP_ADDR;

    process.env.CONSUL_ENABLED = 'true';
    process.env.CONSUL_HTTP_ADDR = 'http://127.0.0.1:8500';

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true, load: [consulConfig] }),
        ConsulModule
      ]
    }).compile();
  });

  afterAll(async () => {
    await moduleRef.close();

    if (typeof originalEnabled === 'string') {
      process.env.CONSUL_ENABLED = originalEnabled;
    } else {
      delete process.env.CONSUL_ENABLED;
    }

    if (typeof originalAddr === 'string') {
      process.env.CONSUL_HTTP_ADDR = originalAddr;
    } else {
      delete process.env.CONSUL_HTTP_ADDR;
    }
  });

  it('initializes Consul client using factory', () => {
    const client = moduleRef.get<Consul | null>(CONSUL_CLIENT);
    expect(client).not.toBeNull();
  });
});
