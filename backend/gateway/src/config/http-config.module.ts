import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';

import httpConfig from './http.config';

export type HttpConfig = ConfigType<typeof httpConfig>;

@Module({
  imports: [ConfigModule.forFeature(httpConfig)],
  exports: [ConfigModule]
})
export class HttpConfigModule {}
