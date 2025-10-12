import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

import type { UpstreamsConfig } from '../../config/upstreams.config';
import { RestProxyService } from './rest-proxy.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<UpstreamsConfig>) => {
        const config = configService.get<UpstreamsConfig>('upstreams', { infer: true });

        return {
          timeout: config?.defaultTimeout ?? 5000,
          maxRedirects: 0
        };
      }
    })
  ],
  providers: [RestProxyService],
  exports: [RestProxyService]
})
export class ProxyModule {}
