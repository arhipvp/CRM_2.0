import { Module } from '@nestjs/common';

import { ProxyModule } from '../proxy/proxy.module';
import { AuthProxyController } from './auth.controller';

@Module({
  imports: [ProxyModule],
  controllers: [AuthProxyController]
})
export class AuthModule {}
