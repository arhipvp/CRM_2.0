import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type Consul from 'consul';
import ConsulFactory = require('consul');

type ConsulOptions = {
  host?: string;
  port?: number;
  secure?: boolean;
  defaults?: {
    token?: string;
    dc?: string;
  };
};

type ConsulConstructor = new (options: ConsulOptions) => Consul;

import consulConfig, { ConsulConfig } from '../../config/consul.config';
import { CONSUL_CLIENT } from './consul.constants';
import { ConsulService } from './consul.service';

const resolveConsulConstructor = (moduleExport: unknown): ConsulConstructor => {
  const directExport = typeof moduleExport === 'function' ? moduleExport : undefined;
  const defaultExport =
    typeof (moduleExport as { default?: unknown })?.default === 'function'
      ? (moduleExport as { default: unknown }).default
      : undefined;
  const namedExport =
    typeof (moduleExport as { Consul?: unknown })?.Consul === 'function'
      ? (moduleExport as { Consul: unknown }).Consul
      : undefined;

  const constructor = (directExport ?? defaultExport ?? namedExport) as unknown;

  if (typeof constructor !== 'function') {
    throw new Error('Unable to resolve Consul constructor from "consul" module export');
  }

  return constructor as ConsulConstructor;
};

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

        const consulOptions: ConsulOptions = {
          host: config.host,
          port: config.port,
          secure: config.scheme === 'https',
          defaults: {
            token: config.token,
            dc: config.dc
          }
        };

        const ConsulClient = resolveConsulConstructor(ConsulFactory);

        try {
          return new ConsulClient(consulOptions);
        } catch (error) {
          if (error instanceof TypeError) {
            return (ConsulClient as unknown as (options: ConsulOptions) => Consul)(
              consulOptions,
            );
          }

          throw error;
        }
      }
    },
    ConsulService
  ],
  exports: [CONSUL_CLIENT, ConsulService]
})
export class ConsulModule {}
