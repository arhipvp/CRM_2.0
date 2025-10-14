from __future__ import annotations

import json
from typing import Any

import aio_pika
from aio_pika import ExchangeType, Message

from crm.app.config import settings


class DomainEventPublisher:
    def __init__(self) -> None:
        self._exchange_name = settings.events_exchange
        self._url = str(settings.rabbitmq_url)

    async def publish(self, routing_key: str, payload: dict[str, Any]) -> None:
        connection = await aio_pika.connect_robust(self._url)
        async with connection:
            channel = await connection.channel(publisher_confirms=True)
            exchange = await channel.declare_exchange(
                self._exchange_name, ExchangeType.TOPIC, durable=True
            )
            message = Message(
                body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                content_type="application/json",
            )
            await exchange.publish(message, routing_key=routing_key)
            await channel.close()
