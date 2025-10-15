from __future__ import annotations

import asyncio
import contextlib
import json
from collections.abc import Awaitable, Callable
from typing import Any

import aio_pika

EventHandler = Callable[[dict[str, Any], dict[str, Any]], Awaitable[None]]


class NotificationsConsumer:
    """Подписчик очереди RabbitMQ для уведомлений и событий CRM."""

    def __init__(
        self,
        amqp_url: str,
        exchange_name: str,
        queue_name: str,
        *,
        routing_key: str = "#",
    ) -> None:
        self._amqp_url = amqp_url
        self._exchange_name = exchange_name
        self._queue_name = queue_name
        self._routing_key = routing_key
        self._connection: aio_pika.RobustConnection | None = None
        self._task: asyncio.Task[None] | None = None

    async def start(self, handler: EventHandler) -> None:
        if self._task is not None and not self._task.done():
            return
        self._task = asyncio.create_task(self._run(handler))

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        if self._connection and not self._connection.is_closed:
            await self._connection.close()

    async def _run(self, handler: EventHandler) -> None:
        self._connection = await aio_pika.connect_robust(self._amqp_url)
        channel = await self._connection.channel()
        exchange = await channel.declare_exchange(
            self._exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
        )
        queue = await channel.declare_queue(self._queue_name, durable=True)
        await queue.bind(exchange, routing_key=self._routing_key)
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                async with message.process():
                    payload = json.loads(message.body.decode("utf-8"))
                    headers = dict(message.headers or {})
                    await handler(payload, headers)


class MemoryConsumer(NotificationsConsumer):
    """Фиктивный consumer для тестов."""

    def __init__(self) -> None:
        super().__init__("amqp://guest:guest@localhost/", "notifications.events", "test")
        self.consumed: list[tuple[dict[str, Any], dict[str, Any]]] = []

    async def start(self, handler: EventHandler) -> None:  # type: ignore[override]
        self._handler = handler

    async def emit(self, payload: dict[str, Any], headers: dict[str, Any] | None = None) -> None:
        headers = headers or {}
        self.consumed.append((payload, headers))
        await self._handler(payload, headers)
