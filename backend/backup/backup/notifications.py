from __future__ import annotations

import asyncio
import json
from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional

import aio_pika

from .config import Settings


@dataclass(slots=True)
class NotificationPayload:
    job_id: int
    run_id: int
    status: str
    artifact_key: Optional[str]
    message: str
    extra: Dict[str, Any]


class NotificationPublisher:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._connection: Optional[aio_pika.RobustConnection] = None
        self._channel: Optional[aio_pika.RobustChannel] = None
        self._exchange: Optional[aio_pika.Exchange] = None
        self._lock = asyncio.Lock()

    async def connect(self) -> None:
        async with self._lock:
            if self._connection and not self._connection.is_closed:
                return
            self._connection = await aio_pika.connect_robust(self._settings.rabbitmq_url)
            self._channel = await self._connection.channel()
            self._exchange = await self._channel.declare_exchange(
                self._settings.notification_exchange,
                aio_pika.ExchangeType.TOPIC,
                durable=True,
            )

    async def close(self) -> None:
        async with self._lock:
            if self._channel and not self._channel.is_closed:
                await self._channel.close()
            if self._connection and not self._connection.is_closed:
                await self._connection.close()
            self._channel = None
            self._connection = None
            self._exchange = None

    async def publish(self, payload: NotificationPayload) -> None:
        if not self._channel or self._channel.is_closed or not self._exchange:
            await self.connect()
        assert self._exchange is not None
        message = aio_pika.Message(
            body=json.dumps(asdict(payload), ensure_ascii=False).encode("utf-8"),
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await self._exchange.publish(
            message,
            routing_key=self._settings.notification_routing_key,
        )
