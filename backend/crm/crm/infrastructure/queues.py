from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from redis.asyncio import Redis


@dataclass
class PermissionsQueue:
    redis: Redis
    queue_name: str
    prefix: str
    job_name: str

    async def enqueue(self, job_id: str, payload: dict[str, object]) -> str:
        timestamp = int(time.time() * 1000)
        queue_prefix = f"{self.prefix}:{self.queue_name}"
        job_key = f"{queue_prefix}:{job_id}"
        wait_key = f"{queue_prefix}:wait"
        meta_key = f"{queue_prefix}:meta"
        id_key = f"{queue_prefix}:id"

        data_json = json.dumps(payload, ensure_ascii=False)
        opts_json = json.dumps(
            {
                "jobId": job_id,
                "timestamp": timestamp,
                "delay": 0,
                "attempts": 1,
                "removeOnComplete": True,
                "removeOnFail": False,
            },
            ensure_ascii=False,
        )

        async with self.redis.pipeline(transaction=True) as pipe:
            pipe.hset(
                job_key,
                mapping={
                    "name": self.job_name,
                    "data": data_json,
                    "opts": opts_json,
                    "timestamp": timestamp,
                    "delay": 0,
                    "priority": 0,
                },
            )
            pipe.zadd(id_key, {job_id: timestamp})
            pipe.rpush(wait_key, job_id)
            pipe.hsetnx(meta_key, "paused", "false")
            pipe.hsetnx(meta_key, "version", "1")
            pipe.hincrby(meta_key, "waiting", 1)
            await pipe.execute()

        return job_id

    async def close(self) -> None:
        await self.redis.aclose()


@dataclass
class TaskReminderQueue:
    redis: Redis
    queue_key: str

    async def schedule(self, reminder_id: UUID | str, run_at: datetime) -> None:
        timestamp = int(run_at.astimezone(timezone.utc).timestamp() * 1000)
        await self.redis.zadd(self.queue_key, {str(reminder_id): timestamp})

    async def remove(self, reminder_id: UUID | str) -> None:
        await self.redis.zrem(self.queue_key, str(reminder_id))

    async def claim_due(
        self, now: datetime | None = None, limit: int = 100
    ) -> list[tuple[str, int]]:
        current = int((now or datetime.now(timezone.utc)).timestamp() * 1000)
        entries = await self.redis.zrangebyscore(
            self.queue_key,
            min=0,
            max=current,
            start=0,
            num=limit,
            withscores=True,
        )
        claimed: list[tuple[str, int]] = []
        for raw_id, score in entries:
            reminder_id = self._ensure_string(raw_id)
            removed = await self.redis.zrem(self.queue_key, reminder_id)
            if removed:
                claimed.append((reminder_id, int(score)))
        return claimed

    @staticmethod
    def _ensure_string(value: object) -> str:
        if isinstance(value, str):
            return value
        if isinstance(value, bytes):
            return value.decode("utf-8")
        return str(value)


@dataclass
class DelayedTaskQueue:
    redis: Redis
    queue_key: str

    async def schedule(self, task_id: UUID | str, run_at: datetime) -> None:
        timestamp = int(run_at.astimezone(timezone.utc).timestamp() * 1000)
        await self.redis.zadd(self.queue_key, {str(task_id): timestamp})

    async def remove(self, task_id: UUID | str) -> None:
        await self.redis.zrem(self.queue_key, str(task_id))

    async def pull_due(
        self, now: datetime | None = None, limit: int = 100
    ) -> list[str]:
        current = int((now or datetime.now(timezone.utc)).timestamp() * 1000)
        entries = await self.redis.zrangebyscore(
            self.queue_key,
            min=0,
            max=current,
            start=0,
            num=limit,
        )
        if entries:
            await self.redis.zrem(
                self.queue_key, *[self._ensure_string(entry) for entry in entries]
            )
        return [self._ensure_string(entry) for entry in entries]

    @staticmethod
    def _ensure_string(value: object) -> str:
        if isinstance(value, str):
            return value
        if isinstance(value, bytes):
            return value.decode("utf-8")
        return str(value)
