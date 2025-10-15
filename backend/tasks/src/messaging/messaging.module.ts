import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    RabbitMQModule.forRootAsync(RabbitMQModule, {
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('tasks.rabbitmq.url');
        const exchange = configService.get<string>('tasks.rabbitmq.events.exchange');

        if (!uri) {
          throw new Error('TASKS_RABBITMQ_URL is not configured');
        }

        if (!exchange) {
          throw new Error('tasks.rabbitmq.events.exchange is not configured');
        }

        return {
          uri,
          connectionInitOptions: { wait: true },
          exchanges: [
            {
              name: exchange,
              type: 'topic'
            }
          ]
        };
      }
    })
  ],
  exports: [RabbitMQModule]
})
export class MessagingModule {}
