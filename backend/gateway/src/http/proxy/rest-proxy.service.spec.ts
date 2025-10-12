import { HttpService } from '@nestjs/axios';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import type { UpstreamsConfig } from '../../config/upstreams.config';
import { ConsulService } from '../../integrations/consul/consul.service';
import { RestProxyService } from './rest-proxy.service';

describe('RestProxyService', () => {
  let httpService: HttpService;
  let configService: ConfigService<UpstreamsConfig>;
  let consulService: ConsulService;
  let service: RestProxyService;
  let req: Request;
  let res: Response;

  const createResponseMock = (): Response => {
    const status = jest.fn().mockReturnThis();
    const setHeader = jest.fn();
    const send = jest.fn();
    const json = jest.fn();
    const end = jest.fn();

    return {
      status,
      setHeader,
      send,
      json,
      end
    } as unknown as Response;
  };

  beforeEach(() => {
    httpService = {
      axiosRef: {
        request: jest.fn()
      }
    } as unknown as HttpService;

    const upstreams: UpstreamsConfig = {
      defaultTimeout: 5000,
      reconnectDelay: 3000,
      heartbeatInterval: 15000,
      heartbeatTtl: 60,
      services: {
        crm: {
          baseUrl: 'http://crm.local/api',
          timeout: 2000,
          serviceName: 'crm-service'
        },
        payments: {
          baseUrl: '',
          timeout: 1000,
          serviceName: 'payments-service'
        },
        auth: {
          baseUrl: 'http://auth.local/api',
          timeout: 5000,
          serviceName: 'auth-service'
        },
        notifications: {
          baseUrl: 'http://notifications.local/api',
          timeout: 5000,
          serviceName: 'notifications-service'
        }
      }
    };

    const getMock = jest.fn((key: string) => {
      if (key === 'upstreams') {
        return upstreams;
      }

      if (key === 'consul.scheme') {
        return 'http';
      }

      return undefined;
    });

    configService = {
      get: getMock
    } as unknown as ConfigService<UpstreamsConfig>;

    consulService = {
      resolveService: jest.fn()
    } as unknown as ConsulService;

    service = new RestProxyService(httpService, configService, consulService);

    req = {
      method: 'GET',
      query: {},
      headers: {
        'x-request-id': 'request-1',
        connection: 'keep-alive'
      }
    } as unknown as Request;

    res = createResponseMock();
  });

  it('forwards requests to configured base url and strips hop-by-hop headers', async () => {
    const axiosRequest = httpService.axiosRef.request as jest.Mock;
    axiosRequest.mockResolvedValue({
      status: 200,
      headers: {
        'content-type': 'application/json',
        connection: 'keep-alive'
      },
      data: { ok: true }
    });

    await service.forward('crm', 'customers/42', req, res);

    expect(axiosRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: 'http://crm.local/api/customers/42',
      data: undefined,
      params: {},
      headers: { 'x-request-id': 'request-1' },
      validateStatus: expect.any(Function),
      timeout: 2000
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
    expect(res.setHeader).not.toHaveBeenCalledWith('connection', expect.anything());
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('resolves base url via Consul when direct url is not provided', async () => {
    const axiosRequest = httpService.axiosRef.request as jest.Mock;
    axiosRequest.mockResolvedValue({
      status: 202,
      headers: {},
      data: 'accepted'
    });

    (consulService.resolveService as jest.Mock).mockResolvedValue({
      address: '10.0.0.10',
      port: 9000
    });

    await service.forward('payments', '/settlements', req, res);

    expect(consulService.resolveService).toHaveBeenCalledWith('payments-service');
    expect(axiosRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: 'http://10.0.0.10:9000/settlements',
      data: undefined,
      params: {},
      headers: { 'x-request-id': 'request-1' },
      validateStatus: expect.any(Function),
      timeout: 1000
    });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.send).toHaveBeenCalledWith('accepted');
  });

  it('returns 503 when upstream call throws without response', async () => {
    const axiosRequest = httpService.axiosRef.request as jest.Mock;
    axiosRequest.mockRejectedValue(new Error('network error'));

    await service.forward('crm', 'customers', req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ message: 'upstream_unavailable' });
  });
});
