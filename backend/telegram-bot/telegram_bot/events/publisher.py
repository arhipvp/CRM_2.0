from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import aio_pika


@dataclass(slots=True)
class IntegrationEvent:
    routing_key: str
    type: str
    data: dict[str, Any]
    trace_id: str | None = None


class IntegrationEventPublisher:
    def __init__(self, amqp_url: str, source: str) -> None:
        self._amqp_url = amqp_url
        self._source = source
        self._connection: aio_pika.RobustConnection | None = None
        self._lock = asyncio.Lock()

    async def connect(self) -> None:
        async with self._lock:
            if self._connection and not self._connection.is_closed:
                return
            self._connection = await aio_pika.connect_robust(self._amqp_url)

    async def close(self) -> None:
        if self._connection and not self._connection.is_closed:
            await self._connection.close()

    async def publish(self, exchange_name: str, event: IntegrationEvent) -> None:
        if self._connection is None or self._connection.is_closed:
            await self.connect()
        assert self._connection is not None
        channel = await self._connection.channel()
        exchange = await channel.declare_exchange(exchange_name, aio_pika.ExchangeType.TOPIC, durable=True)
        payload = {
            "id": str(uuid4()),
            "source": self._source,
            "type": event.type,
            "time": datetime.now(tz=timezone.utc).isoformat(),
            "data": event.data,
        }
        headers = {
            "ce-specversion": "1.0",
        }
        if event.trace_id:
            headers["X-Trace-Id"] = event.trace_id
        message = aio_pika.Message(
            body=json.dumps(payload).encode("utf-8"),
            content_type="application/json",
            headers=headers,
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await exchange.publish(message, routing_key=event.routing_key)
        await channel.close()


class InMemoryPublisher(IntegrationEventPublisher):
    """Вспомогательный издатель для тестов без RabbitMQ."""

    def __init__(self, source: str) -> None:  # type: ignore[call-arg]
        super().__init__("amqp://guest:guest@localhost/", source)
        self.published: list[tuple[str, IntegrationEvent, dict[str, Any]]] = []

    async def publish(self, exchange_name: str, event: IntegrationEvent) -> None:  # type: ignore[override]
        payload = {
            "id": str(uuid4()),
            "source": self._source,
            "type": event.type,
            "time": datetime.now(tz=timezone.utc).isoformat(),
            "data": event.data,
        }
        metadata = {"exchange": exchange_name, "routing_key": event.routing_key}
        self.published.append((exchange_name, event, payload | metadata))
