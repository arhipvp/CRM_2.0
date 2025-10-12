import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

import { ConsulHealthIndicator } from './consul.health-indicator';
import { RedisHealthIndicator } from './redis.health-indicator';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly consulIndicator: ConsulHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.redisIndicator.isHealthy(),
      () => this.consulIndicator.isHealthy()
    ]);
  }
}
