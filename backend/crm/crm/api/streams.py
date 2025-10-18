from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator
from typing import Any

import aio_pika
from aio_pika import ExchangeType
from aio_pika.abc import (
    AbstractExchange,
    AbstractQueue,
    AbstractRobustChannel,
    AbstractRobustConnection,
)
from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from crm.app.config import Settings, get_settings

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL_SECONDS = 30.0

router = APIRouter(tags=["streams"])


async def _events_generator(
    request: Request,
    settings: Settings,
) -> AsyncGenerator[dict[str, Any], None]:
    connection: AbstractRobustConnection | None = None
    channel: AbstractRobustChannel | None = None
    queue: AbstractQueue | None = None
    exchange: AbstractExchange | None = None
    try:
        connection = await aio_pika.connect_robust(str(settings.rabbitmq_url))
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=1)
        exchange = await channel.declare_exchange(
            settings.events_exchange,
            ExchangeType.TOPIC,
            durable=True,
        )
        queue = await channel.declare_queue(exclusive=True, auto_delete=True)
        await queue.bind(exchange, routing_key="#")

        async with queue.iterator() as queue_iter:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(
                        queue_iter.__anext__(), timeout=HEARTBEAT_INTERVAL_SECONDS
                    )
                except asyncio.TimeoutError:
                    yield {"event": "heartbeat", "data": ""}
                    continue
                except StopAsyncIteration:
                    break

                async with message.process(ignore_processed=True):
                    event_name = str(
                        message.headers.get("event")
                        if message.headers and "event" in message.headers
                        else message.routing_key or "message"
                    )
                    data = message.body.decode("utf-8")
                    payload: dict[str, Any] = {"event": event_name, "data": data}
                    if message.message_id is not None:
                        payload["id"] = str(message.message_id)
                    yield payload
    except asyncio.CancelledError:
        raise
    except Exception:  # noqa: BLE001
        logger.exception("Failed to stream events from RabbitMQ")
        raise
    finally:
        try:
            if queue is not None and exchange is not None:
                await queue.unbind(exchange, routing_key="#")
                await queue.delete(if_unused=False, if_empty=False)
        except Exception:  # noqa: BLE001
            logger.debug("Failed to cleanup SSE queue", exc_info=True)
        if channel is not None:
            try:
                await channel.close()
            except Exception:  # noqa: BLE001
                logger.debug("Failed to close RabbitMQ channel", exc_info=True)
        if connection is not None:
            try:
                await connection.close()
            except Exception:  # noqa: BLE001
                logger.debug("Failed to close RabbitMQ connection", exc_info=True)


@router.get("/streams", include_in_schema=False)
async def streams_endpoint(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> EventSourceResponse:
    generator = _events_generator(request, settings)
    return EventSourceResponse(generator, ping=None)
