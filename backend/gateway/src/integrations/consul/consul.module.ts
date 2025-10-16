import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type Consul from 'consul';
import ConsulFactory = require('consul');

type ConsulFactoryFn = (options: {
  host?: string;
  port?: number;
  secure?: boolean;
  defaults?: {
    token?: string;
    dc?: string;
  };
}) => Consul;

type ConsulConstructor = new (options: Parameters<ConsulFactoryFn>[0]) => Consul;

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

        const createConsulClient = ConsulFactory as unknown as ConsulFactoryFn;
        const consulCtor = ConsulFactory as unknown as ConsulConstructor;
        const consulOptions: Parameters<ConsulFactoryFn>[0] = {
          host: config.host,
          port: config.port,
          secure: config.scheme === 'https',
          defaults: {
            token: config.token,
            dc: config.dc
          }
        };

        try {
          return createConsulClient(consulOptions);
        } catch (error) {
          if (error instanceof TypeError && error.message.includes("without 'new'")) {
            return Reflect.construct(consulCtor, [consulOptions]);
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
