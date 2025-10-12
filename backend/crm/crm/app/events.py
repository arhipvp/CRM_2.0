from __future__ import annotations

import asyncio
import json
from typing import Any

import aio_pika
from aio_pika import ExchangeType, Message
from aio_pika.abc import AbstractRobustConnection
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from crm.app.config import Settings, settings
from crm.domain import schemas
from crm.domain.services import PaymentSyncService
from crm.infrastructure.repositories import DealRepository, PaymentSyncLogRepository


class PaymentsEventsSubscriber:
    def __init__(
        self,
        settings: Settings,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        self._settings = settings
        self._session_factory = session_factory
        self._connection: AbstractRobustConnection | None = None
        self._channel: aio_pika.abc.AbstractChannel | None = None
        self._consume_task: asyncio.Task[Any] | None = None
        self._closing = asyncio.Event()

    async def start(self) -> None:
        if self._connection:
            return
        self._connection = await aio_pika.connect_robust(str(self._settings.rabbitmq_url))
        self._channel = await self._connection.channel(publisher_confirms=True)
        await self._setup_topology()
        queue = await self._channel.declare_queue(self._settings.payments_queue, durable=True)
        await queue.consume(self._handle_message, no_ack=False)
        self._consume_task = asyncio.create_task(self._closing.wait())

    async def stop(self) -> None:
        self._closing.set()
        if self._consume_task:
            await self._consume_task
        if self._channel:
            await self._channel.close()
        if self._connection:
            await self._connection.close()
        self._connection = None
        self._channel = None
        self._consume_task = None
        self._closing.clear()

    async def _setup_topology(self) -> None:
        assert self._channel is not None
        payments_exchange = await self._channel.declare_exchange(
            self._settings.payments_exchange, ExchangeType.TOPIC, durable=True
        )
        await self._channel.declare_exchange(self._settings.events_exchange, ExchangeType.TOPIC, durable=True)
        retry_exchange = await self._channel.declare_exchange(
            self._settings.payments_retry_exchange, ExchangeType.DIRECT, durable=True
        )
        dlx_exchange = await self._channel.declare_exchange(
            self._settings.payments_dlx_exchange, ExchangeType.FANOUT, durable=True
        )
        queue_arguments = {
            "x-dead-letter-exchange": retry_exchange.name,
            "x-dead-letter-routing-key": "retry",
        }
        await self._channel.declare_queue(
            self._settings.payments_queue,
            durable=True,
            arguments=queue_arguments,
        )
        retry_arguments = {
            "x-dead-letter-exchange": payments_exchange.name,
            "x-dead-letter-routing-key": "payments.retry",
            "x-message-ttl": self._settings.payments_retry_delay_ms,
        }
        retry_queue = await self._channel.declare_queue(
            self._settings.payments_retry_queue,
            durable=True,
            arguments=retry_arguments,
        )
        await retry_queue.bind(retry_exchange, routing_key="retry")
        dlx_queue = await self._channel.declare_queue(self._settings.payments_dlx_queue, durable=True)
        await dlx_queue.bind(dlx_exchange, routing_key="dead")
        queue = await self._channel.get_queue(self._settings.payments_queue)
        await queue.bind(payments_exchange, routing_key="payments.*")

    async def _handle_message(self, message: aio_pika.abc.AbstractIncomingMessage) -> None:
        async with message.process(requeue=False):
            try:
                payload = json.loads(message.body.decode("utf-8"))
                event = schemas.PaymentEvent.model_validate(payload)
            except Exception as exc:  # noqa: BLE001
                await self._publish_to_dlx(message, reason=str(exc))
                return

            async with self._session_factory() as session:
                service = PaymentSyncService(
                    PaymentSyncLogRepository(session),
                    DealRepository(session),
                )
                try:
                    result = await service.handle_payment_event(event)
                except Exception as exc:  # noqa: BLE001
                    if self._should_dead_letter(message):
                        await self._publish_to_dlx(message, reason=str(exc))
                        return
                    raise
                if result.processed:
                    await self._publish_event("payments.synced", event)

    async def _publish_event(self, routing_key: str, event: schemas.PaymentEvent) -> None:
        assert self._channel is not None
        exchange = await self._channel.get_exchange(self._settings.events_exchange)
        message = Message(
            body=json.dumps(event.model_dump()).encode("utf-8"),
            content_type="application/json",
            headers={"event": routing_key},
        )
        await exchange.publish(message, routing_key=routing_key)

    async def _publish_to_dlx(self, message: aio_pika.abc.AbstractIncomingMessage, reason: str) -> None:
        assert self._channel is not None
        dlx_exchange = await self._channel.get_exchange(self._settings.payments_dlx_exchange)
        headers = dict(message.headers or {})
        headers["dead-letter-reason"] = reason
        dlx_message = Message(
            body=message.body,
            content_type=message.content_type,
            headers=headers,
        )
        await dlx_exchange.publish(dlx_message, routing_key="dead")

    def _should_dead_letter(self, message: aio_pika.abc.AbstractIncomingMessage) -> bool:
        headers = message.headers or {}
        deaths = headers.get("x-death")
        if not deaths:
            return False
        try:
            last_attempt = deaths[0]
            attempts = int(last_attempt.get("count", 0))
        except Exception:  # noqa: BLE001
            return False
        return attempts >= self._settings.payments_retry_limit

async def _run_forever() -> None:
    from crm.app.dependencies import get_session_factory

    subscriber = PaymentsEventsSubscriber(settings, get_session_factory())
    await subscriber.start()
    try:
        await asyncio.Event().wait()
    finally:
        await subscriber.stop()


if __name__ == "__main__":
    asyncio.run(_run_forever())
