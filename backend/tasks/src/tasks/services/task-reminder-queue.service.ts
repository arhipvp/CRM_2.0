import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class TaskReminderQueueService {
  private readonly queueKey: string;

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    configService: ConfigService
  ) {
    this.queueKey = configService.get<string>('tasks.redis.remindersQueueKey', 'tasks:reminders');
  }

  async schedule(reminderId: string, runAt: Date): Promise<void> {
    await this.redis.zadd(this.queueKey, runAt.getTime(), reminderId);
  }
}
