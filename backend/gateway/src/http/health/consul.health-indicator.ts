import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import type Consul from 'consul';

import type { ConsulConfig } from '../../config/consul.config';
import { CONSUL_CLIENT } from '../../integrations/consul/consul.constants';

@Injectable()
export class ConsulHealthIndicator extends HealthIndicator {
  constructor(
    private readonly configService: ConfigService<ConsulConfig>,
    @Inject(CONSUL_CLIENT) private readonly consul: Consul | null
  ) {
    super();
  }

  async isHealthy(key = 'consul'): Promise<HealthIndicatorResult> {
    const enabled = this.configService.get<boolean>('consul.enabled', { infer: true }) ?? true;

    if (!enabled || !this.consul) {
      return this.getStatus(key, true, { disabled: true });
    }

    try {
      await this.consul.status.leader();
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError('Consul check failed', this.getStatus(key, false, { error }));
    }
  }
}
