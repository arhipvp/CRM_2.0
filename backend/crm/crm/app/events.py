from __future__ import annotations

import asyncio
import json
from typing import Any

import aio_pika
from aio_pika import ExchangeType, Message
from aio_pika.abc import AbstractChannel, AbstractExchange, AbstractRobustConnection

from crm.app.config import Settings


class EventsPublisher:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._connection: AbstractRobustConnection | None = None
        self._channel: AbstractChannel | None = None
        self._exchange: AbstractExchange | None = None
        self._lock = asyncio.Lock()

    async def connect(self) -> None:
        if self._exchange is not None:
            return
        async with self._lock:
            if self._exchange is not None:
                return
            self._connection = await aio_pika.connect_robust(str(self._settings.rabbitmq_url))
            self._channel = await self._connection.channel(publisher_confirms=True)
            self._exchange = await self._channel.declare_exchange(
                self._settings.events_exchange, ExchangeType.TOPIC, durable=True
            )

    async def close(self) -> None:
        async with self._lock:
            exchange = self._exchange
            channel = self._channel
            connection = self._connection
            self._exchange = None
            self._channel = None
            self._connection = None
        if channel is not None:
            await channel.close()
        if connection is not None:
            await connection.close()

    async def publish(self, routing_key: str, payload: dict[str, Any]) -> None:
        await self.connect()
        assert self._exchange is not None
        message = Message(
            body=json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8"),
            content_type="application/json",
            headers={"event": routing_key},
        )
        await self._exchange.publish(message, routing_key=routing_key)
