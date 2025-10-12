import { Module } from '@nestjs/common';

import { ProxyModule } from '../proxy/proxy.module';
import { PaymentsProxyController } from './payments.controller';

@Module({
  imports: [ProxyModule],
  controllers: [PaymentsProxyController]
})
export class PaymentsModule {}
