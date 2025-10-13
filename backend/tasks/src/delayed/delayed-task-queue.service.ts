import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { TASKS_REDIS_CLIENT } from '../redis/constants';

@Injectable()
export class DelayedTaskQueueService {
  private readonly queueKey: string;

  constructor(
    @Inject(TASKS_REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly configService: ConfigService
  ) {
    this.queueKey = this.configService.get<string>('tasks.redis.delayedQueueKey', 'tasks:delayed');
  }

  async schedule(taskId: string, runAt: Date): Promise<void> {
    await this.redis.zadd(this.queueKey, runAt.getTime(), taskId);
  }

  async remove(taskId: string): Promise<void> {
    await this.redis.zrem(this.queueKey, taskId);
  }

  async pullDue(now = Date.now(), limit = 100): Promise<string[]> {
    const ids = await this.redis.zrangebyscore(this.queueKey, 0, now, 'LIMIT', 0, limit);
    if (ids.length > 0) {
      await this.redis.zrem(this.queueKey, ...ids);
    }
    return ids;
  }
}
