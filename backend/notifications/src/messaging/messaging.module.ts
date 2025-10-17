import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { NotificationsConfiguration } from '../config/configuration';

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (
        configService: ConfigService<NotificationsConfiguration>
      ) => {
        const uri = configService.getOrThrow<string>('rabbitmq.uri', { infer: true });
        const exchange = configService.getOrThrow<string>('rabbitmq.exchange', { infer: true });

        return {
          uri,
          exchanges: [
            {
              name: exchange,
              type: 'topic'
            }
          ],
          connectionInitOptions: { wait: true },
          enableControllerDiscovery: true
        };
      }
    })
  ],
  exports: [RabbitMQModule]
})
export class MessagingModule {}
