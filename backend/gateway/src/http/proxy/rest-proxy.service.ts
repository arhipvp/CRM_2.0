import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import type { Request, Response } from 'express';
import type { AxiosResponseHeaders } from 'axios';

import type { UpstreamServiceConfig, UpstreamTarget, UpstreamsConfig } from '../../config/upstreams.config';
import { ConsulService } from '../../integrations/consul/consul.service';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);

@Injectable()
export class RestProxyService {
  private readonly logger = new Logger(RestProxyService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<UpstreamsConfig>,
    private readonly consulService: ConsulService
  ) {}

  async forward(target: UpstreamTarget, path: string, req: Request, res: Response): Promise<void> {
    const upstreams = this.configService.get<UpstreamsConfig>('upstreams', { infer: true });
    const upstream = upstreams?.services[target];

    if (!upstream) {
      throw new ServiceUnavailableException(`Upstream configuration for "${target}" is missing`);
    }

    const baseUrl = await this.resolveBaseUrl(upstream, target);

    if (!baseUrl) {
      throw new ServiceUnavailableException(`Upstream "${target}" is unavailable`);
    }

    const url = this.buildUrl(baseUrl, path);
    const method = req.method?.toUpperCase();
    const data = method && ['GET', 'HEAD', 'OPTIONS'].includes(method) ? undefined : (req as any).body;

    const headers = this.prepareHeaders(req.headers ?? {});

    try {
      const response = await this.httpService.axiosRef.request({
        method,
        url,
        data,
        params: req.query,
        headers,
        validateStatus: () => true,
        timeout: upstream.timeout ?? upstreams?.defaultTimeout
      });

      this.forwardResponse(res, response.status, response.headers, response.data);
    } catch (error) {
      const axiosError = error as { response?: { status: number; headers: Record<string, string>; data: unknown } };

      if (axiosError.response) {
        this.forwardResponse(
          res,
          axiosError.response.status,
          axiosError.response.headers,
          axiosError.response.data
        );
        return;
      }

      this.logger.error(
        `Upstream request to ${url} failed: ${(error as Error).message}`,
        (error as Error).stack
      );
      res.status(503).json({ message: 'upstream_unavailable' });
    }
  }

  private prepareHeaders(headers: Request['headers']): Record<string, string> {
    const prepared: Record<string, string> = {};

    Object.entries(headers).forEach(([key, value]) => {
      if (!value) {
        return;
      }

      const headerKey = key.toLowerCase();

      if (headerKey === 'host' || HOP_BY_HOP_HEADERS.has(headerKey)) {
        return;
      }

      prepared[headerKey] = Array.isArray(value) ? value.join(',') : String(value);
    });

    return prepared;
  }

  private forwardResponse(
    res: Response,
    status: number,
    headers: AxiosResponseHeaders | Record<string, unknown>,
    data: unknown
  ): void {
    const normalizedHeaders: Record<string, unknown> =
      typeof (headers as AxiosResponseHeaders)?.toJSON === 'function'
        ? ((headers as AxiosResponseHeaders).toJSON() as Record<string, unknown>)
        : ((headers as Record<string, unknown>) ?? {});

    Object.entries(normalizedHeaders).forEach(([key, value]) => {
      const headerKey = key.toLowerCase();

      if (HOP_BY_HOP_HEADERS.has(headerKey)) {
        return;
      }

      if (value === undefined || value === null) {
        return;
      }

      const headerValue = Array.isArray(value) ? value : String(value);
      res.setHeader(key, headerValue);
    });

    res.status(status);

    if (data === undefined) {
      res.end();
      return;
    }

    if (Buffer.isBuffer(data) || typeof data === 'string') {
      res.send(data);
      return;
    }

    res.json(data);
  }

  private buildUrl(baseUrl: string, path: string): string {
    const normalizedBase = baseUrl.replace(/\/$/, '');
    const normalizedPath = path ? `/${path.replace(/^\//, '')}` : '';

    return `${normalizedBase}${normalizedPath}`;
  }

  private async resolveBaseUrl(
    upstream: UpstreamServiceConfig,
    target: UpstreamTarget
  ): Promise<string | null> {
    if (upstream.baseUrl) {
      return upstream.baseUrl;
    }

    if (!upstream.serviceName) {
      return null;
    }

    const endpoint = await this.consulService.resolveService(upstream.serviceName);

    if (!endpoint) {
      this.logger.warn(`Consul did not return an address for ${target}`);
      return null;
    }

    const scheme = this.configService.get<string>('consul.scheme', { infer: true }) ?? 'http';
    return `${scheme}://${endpoint.address}:${endpoint.port}`;
  }
}
