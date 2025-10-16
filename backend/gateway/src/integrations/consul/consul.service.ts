import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Consul } from 'consul/lib/consul';

import type { ConsulConfig } from '../../config/consul.config';
import { CONSUL_CLIENT } from './consul.constants';

interface ServiceEndpoint {
  address: string;
  port: number;
}

@Injectable()
export class ConsulService {
  private readonly logger = new Logger(ConsulService.name);
  private readonly enabled: boolean;

  constructor(
    @Inject(CONSUL_CLIENT) private readonly consul: Consul | null,
    private readonly configService: ConfigService<ConsulConfig>
  ) {
    this.enabled = this.configService.get<boolean>('consul.enabled', { infer: true }) ?? true;
  }

  async resolveService(serviceName: string): Promise<ServiceEndpoint | null> {
    if (!this.enabled || !this.consul) {
      return null;
    }

    try {
      const result = (await this.consul.health.service({ service: serviceName, passing: true })) as unknown as Array<{
        Service: { Address: string; Port: number };
        Node: { Address: string };
      }>;

      const service = Array.isArray(result)
        ? result.find((node) => node.Service?.Address || node.Node?.Address)
        : undefined;
      if (!service) {
        return null;
      }

      return {
        address: service.Service?.Address ?? service.Node?.Address,
        port: service.Service?.Port
      };
    } catch (error) {
      this.logger.warn(`Failed to resolve service "${serviceName}": ${(error as Error).message}`);
      return null;
    }
  }
}
