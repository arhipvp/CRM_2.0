import { Module } from '@nestjs/common';

import { ProxyModule } from '../proxy/proxy.module';
import { CrmProxyController } from './crm.controller';

@Module({
  imports: [ProxyModule],
  controllers: [CrmProxyController]
})
export class CrmModule {}
