import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createParser } from 'eventsource-parser';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Readable } from 'stream';
import type { Redis } from 'ioredis';

import type { RedisConfig } from '../config/redis.config';
import type { UpstreamServiceConfig, UpstreamTarget, UpstreamsConfig } from '../config/upstreams.config';
import { REDIS_CLIENT } from '../integrations/redis/redis.constants';

interface StreamOptions {
  path?: string;
}

@Injectable()
export class UpstreamSseService {
  private readonly logger = new Logger(UpstreamSseService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis
  ) {}

  stream(target: UpstreamTarget, options: StreamOptions = {}): Observable<MessageEvent> {
    const upstreams = this.configService.get<UpstreamsConfig>('upstreams', { infer: true });
    const redisConfig = this.configService.get<RedisConfig>('redis', { infer: true });
    const upstream = upstreams?.services[target];

    if (!upstream?.sse?.url) {
      throw new ServiceUnavailableException(`SSE upstream for ${target} is not configured`);
    }

    const reconnectDelay = upstreams?.reconnectDelay ?? 3000;
    const heartbeatInterval = upstreams?.heartbeatInterval ?? 15000;
    const heartbeatTtl = upstreams?.heartbeatTtl ?? 60;
    const ttlSeconds = Math.max(1, heartbeatTtl);
    const heartbeatPrefix = redisConfig?.heartbeatPrefix ?? 'gateway:sse';
    const heartbeatKey = `${heartbeatPrefix}:${target}`;
    const lastEventKey = `${heartbeatKey}:last-event-id`;

    const endpointUrl = this.resolveUrl(upstream, options.path);

    return new Observable<MessageEvent>((subscriber) => {
      let closed = false;
      let reconnectTimer: NodeJS.Timeout | null = null;
      let heartbeatTimer: NodeJS.Timeout | null = null;
      let controller: AbortController | null = null;
      let stream: Readable | null = null;
      let lastEventId: string | null = null;

      const pushHeartbeat = () => {
        subscriber.next({
          type: 'heartbeat',
          data: JSON.stringify({ upstream: target, ts: new Date().toISOString() })
        });
      };

      const updateKeys = async (eventId?: string): Promise<void> => {
        try {
          const pipeline = this.redis.multi();
          pipeline.set(heartbeatKey, Date.now().toString(), 'EX', ttlSeconds);
          if (eventId) {
            pipeline.set(lastEventKey, eventId, 'EX', ttlSeconds);
          }
          await pipeline.exec();
        } catch (error) {
          this.logger.warn(`Redis heartbeat update failed for ${target}: ${(error as Error).message}`);
        }
      };

      const scheduleHeartbeat = () => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
        }

        heartbeatTimer = setInterval(() => {
          pushHeartbeat();
          void updateKeys(lastEventId ?? undefined);
        }, heartbeatInterval);
      };

      const cleanupStream = () => {
        if (stream) {
          stream.removeAllListeners('data');
          stream.removeAllListeners('end');
          stream.removeAllListeners('error');
          stream = null;
        }
      };

      const connect = async () => {
        if (closed) {
          return;
        }

        try {
          const storedId = await this.redis.get(lastEventKey);
          if (storedId) {
            lastEventId = storedId;
          }
        } catch (error) {
          this.logger.warn(`Unable to read last event id for ${target}: ${(error as Error).message}`);
        }

        controller = new AbortController();

        try {
          const response = await this.httpService.axiosRef.get(endpointUrl, {
            responseType: 'stream',
            signal: controller.signal,
            headers: lastEventId ? { 'Last-Event-ID': lastEventId } : undefined,
            timeout: 0
          });

          stream = response.data as Readable;
          const parser = createParser((event) => {
            if (event.type !== 'event') {
              return;
            }

            if (event.id) {
              lastEventId = event.id;
            }

            subscriber.next({
              type: event.event ?? undefined,
              data: event.data
            });

            void updateKeys(event.id ?? undefined);
          });

          stream.on('data', (chunk: Buffer | string) => {
            parser.feed(chunk.toString());
          });

          stream.on('end', () => {
            cleanupStream();
            if (!closed) {
              reconnectTimer = setTimeout(connect, reconnectDelay);
            } else {
              subscriber.complete();
            }
          });

          stream.on('error', (error) => {
            this.logger.warn(`SSE upstream error for ${target}: ${(error as Error).message}`);
            cleanupStream();
            if (!closed) {
              reconnectTimer = setTimeout(connect, reconnectDelay);
            } else {
              subscriber.error(error);
            }
          });

          await updateKeys(lastEventId ?? undefined);
          scheduleHeartbeat();
        } catch (error) {
          this.logger.error(`Failed to connect to SSE upstream ${endpointUrl}: ${(error as Error).message}`);
          cleanupStream();

          if (!closed) {
            reconnectTimer = setTimeout(connect, reconnectDelay);
          } else {
            subscriber.error(error);
          }
        }
      };

      pushHeartbeat();
      void updateKeys();
      scheduleHeartbeat();
      void connect();

      return () => {
        closed = true;
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
        }
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }
        if (controller) {
          controller.abort();
        }
        cleanupStream();
      };
    });
  }

  private resolveUrl(upstream: UpstreamServiceConfig, path?: string): string {
    const base = upstream.sse?.url?.replace(/\/$/, '') ?? upstream.baseUrl.replace(/\/$/, '');
    const normalizedPath = path ? `/${path.replace(/^\//, '')}` : '';
    return `${base}${normalizedPath}`;
  }
}
