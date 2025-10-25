from __future__ import annotations

import asyncio
import json
from typing import Any

import aio_pika
from aio_pika import ExchangeType, Message
from aio_pika.abc import AbstractExchange, AbstractRobustChannel, AbstractRobustConnection
from redis.asyncio import Redis

from crm.app.config import Settings


class NotificationDispatcher:
    def __init__(self, settings: Settings, redis: Redis) -> None:
        self._settings = settings
        self._redis = redis
        self._connection: AbstractRobustConnection | None = None
        self._channel: AbstractRobustChannel | None = None
        self._exchanges: dict[str, AbstractExchange] = {}
        self._lock = asyncio.Lock()

    async def publish_rabbit(self, exchange_name: str, routing_key: str, message: dict[str, Any]) -> None:
        exchange = await self._get_exchange(exchange_name)
        body = json.dumps(message, ensure_ascii=False, default=str).encode("utf-8")
        await exchange.publish(
            Message(body=body, content_type="application/json", delivery_mode=aio_pika.DeliveryMode.PERSISTENT),
            routing_key=routing_key,
        )

    async def publish_redis(self, channel: str, message: dict[str, Any]) -> None:
        payload = json.dumps(message, ensure_ascii=False, default=str)
        await self._redis.publish(channel, payload)

    async def close(self) -> None:
        async with self._lock:
            exchanges = list(self._exchanges.values())
            self._exchanges.clear()
            channel = self._channel
            connection = self._connection
            self._channel = None
            self._connection = None
        for exchange in exchanges:
            try:
                await exchange.close()
            except Exception:  # noqa: BLE001
                continue
        if channel is not None:
            try:
                await channel.close()
            except Exception:  # noqa: BLE001
                pass
        if connection is not None:
            try:
                await connection.close()
            except Exception:  # noqa: BLE001
                pass

    async def _get_exchange(self, exchange_name: str) -> AbstractExchange:
        async with self._lock:
            if exchange_name in self._exchanges:
                return self._exchanges[exchange_name]
            if self._connection is None:
                self._connection = await aio_pika.connect_robust(str(self._settings.rabbitmq_url))
            if self._channel is None:
                self._channel = await self._connection.channel(publisher_confirms=True)
            exchange = await self._channel.declare_exchange(
                exchange_name,
                ExchangeType.TOPIC,
                durable=True,
            )
            self._exchanges[exchange_name] = exchange
            return exchange
