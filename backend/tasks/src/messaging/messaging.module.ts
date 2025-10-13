import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { TASKS_EVENTS_CLIENT } from './constants';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: TASKS_EVENTS_CLIENT,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const url = configService.get<string>('tasks.rabbitmq.url');
          const queue = configService.get<string>('tasks.rabbitmq.eventsQueue');
          return {
            transport: Transport.RMQ,
            options: {
              urls: url ? [url] : [],
              queue,
              persistent: true,
              queueOptions: {
                durable: true
              }
            }
          };
        }
      }
    ])
  ],
  exports: [ClientsModule]
})
export class MessagingModule {}
