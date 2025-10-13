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

  async claimDue(now = Date.now(), limit = 100): Promise<Array<{ id: string; score: number }>> {
    const entries = await this.redis.zrangebyscore(
      this.queueKey,
      0,
      now,
      'WITHSCORES',
      'LIMIT',
      0,
      limit
    );

    const claimed: Array<{ id: string; score: number }> = [];

    for (let index = 0; index < entries.length; index += 2) {
      const id = entries[index];
      const score = Number(entries[index + 1]);

      const removed = await this.redis.zrem(this.queueKey, id);
      if (removed > 0) {
        claimed.push({ id, score });
      }
    }

    return claimed;
  }
}
