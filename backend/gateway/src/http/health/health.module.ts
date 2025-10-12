import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import { ConsulHealthIndicator } from './consul.health-indicator';
import { RedisHealthIndicator } from './redis.health-indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, ConsulHealthIndicator]
})
export class HealthModule {}
