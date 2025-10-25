from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import aio_pika
from aio_pika import ExchangeType
from aio_pika.abc import AbstractChannel, AbstractQueue, AbstractRobustConnection

from crm.app.config import Settings
from crm.domain import schemas, services
from crm.infrastructure.db import AsyncSessionFactory
from crm.infrastructure import repositories


logger = logging.getLogger(__name__)


class NotificationQueueConsumer:
    def __init__(
        self,
        settings: Settings,
        stream: services.NotificationStreamService,
        telegram: services.TelegramService,
    ) -> None:
        self._settings = settings
        self._stream = stream
        self._telegram = telegram
        self._connection: AbstractRobustConnection | None = None
        self._channel: AbstractChannel | None = None
        self._queue: AbstractQueue | None = None
        self._task: asyncio.Task[None] | None = None
        self._running = False
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        async with self._lock:
            if self._running:
                return
            self._running = True
            self._task = asyncio.create_task(self._run())
            logger.info("Notification queue consumer started")

    async def stop(self) -> None:
        async with self._lock:
            self._running = False
            task = self._task
            self._task = None
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        await self._cleanup()
        logger.info("Notification queue consumer stopped")

    async def _run(self) -> None:
        while self._running:
            try:
                await self._consume_loop()
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001
                logger.exception("Notification queue consumer crashed; retrying in 5 seconds")
                await asyncio.sleep(5)
            finally:
                await self._cleanup()

    async def _consume_loop(self) -> None:
        self._connection = await aio_pika.connect_robust(str(self._settings.rabbitmq_url))
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=1)
        exchange = await self._channel.declare_exchange(
            self._settings.notifications_dispatch_exchange,
            ExchangeType.TOPIC,
            durable=True,
        )
        self._queue = await self._channel.declare_queue(
            self._settings.notifications_queue_name,
            durable=self._settings.notifications_queue_durable,
        )
        await self._queue.bind(
            exchange,
            routing_key=self._settings.notifications_queue_routing_key,
        )

        assert self._queue is not None
        async with self._queue.iterator() as iterator:
            async for message in iterator:
                if not self._running:
                    break
                async with message.process(ignore_processed=True):
                    try:
                        payload = self._parse_payload(message.body)
                        await self._handle_payload(payload)
                    except Exception:  # noqa: BLE001
                        logger.exception("Failed to process notification message")
                        continue

    async def _handle_payload(self, payload: dict[str, Any]) -> None:
        required_keys = {"id", "type", "time", "data"}
        if not required_keys.issubset(payload):
            logger.debug("Skipping notification payload without event fields: %s", payload.keys())
            return
        dto = schemas.NotificationEventIngest.model_validate(payload)
        async with AsyncSessionFactory() as session:
            repository = repositories.NotificationEventRepository(session)
            service = services.NotificationEventsService(
                repository,
                self._stream,
                self._telegram,
            )
            await service.handle_incoming(dto)

    @staticmethod
    def _parse_payload(body: bytes) -> dict[str, Any]:
        decoded = body.decode("utf-8")
        return json.loads(decoded)

    async def _cleanup(self) -> None:
        if self._queue is not None:
            try:
                await self._queue.unbind(
                    self._settings.notifications_dispatch_exchange,
                    routing_key=self._settings.notifications_queue_routing_key,
                )
            except Exception:  # noqa: BLE001
                pass
        if self._channel is not None:
            try:
                await self._channel.close()
            except Exception:  # noqa: BLE001
                pass
        if self._connection is not None:
            try:
                await self._connection.close()
            except Exception:  # noqa: BLE001
                pass
        self._connection = None
        self._channel = None
        self._queue = None
