from __future__ import annotations

import json
import time
from dataclasses import dataclass

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
