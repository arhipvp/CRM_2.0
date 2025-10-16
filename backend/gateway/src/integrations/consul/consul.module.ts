import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Consul } from 'consul/lib/consul';

import consulConfig, { ConsulConfig } from '../../config/consul.config';
import { CONSUL_CLIENT } from './consul.constants';
import { ConsulService } from './consul.service';

type ConsulConstructor = typeof import('consul');
const RawConsulClient = require('consul') as ConsulConstructor;
type ConsulOptions = ConstructorParameters<ConsulConstructor>[0];
const ConsulClient = (options: ConsulOptions): Consul => new RawConsulClient(options);

@Global()
@Module({
  imports: [ConfigModule.forFeature(consulConfig)],
  providers: [
    {
      provide: CONSUL_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<ConsulConfig>): Consul | null => {
        const config = configService.get<ConsulConfig>('consul', { infer: true });

        if (!config?.enabled) {
          return null;
        }

        return ConsulClient({
          host: config.host,
          port: config.port,
          secure: config.scheme === 'https',
          defaults: {
            token: config.token,
            dc: config.dc
          }
        });
      }
    },
    ConsulService
  ],
  exports: [CONSUL_CLIENT, ConsulService]
})
export class ConsulModule {}
