from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator

import pytest

from crm.app import config as app_config
from crm.app.events import EventsPublisher


async def _read_sse_event(lines: AsyncIterator[str]) -> dict[str, str]:
    event: dict[str, str] = {}
    data_lines: list[str] = []

    async for line in lines:
        if line == "":
            event.setdefault("data", "\n".join(data_lines))
            return event
        if line.startswith(":"):
            continue
        field, _, value = line.partition(":")
        value = value.lstrip(" ")
        if field == "event":
            event["event"] = value
        elif field == "data":
            data_lines.append(value)
        elif field == "id":
            event["id"] = value
    raise AssertionError("Stream closed before event was received")


@pytest.mark.asyncio
async def test_streams_endpoint_delivers_events_and_closes_on_cancel(api_client):
    settings = app_config.settings
    publisher = EventsPublisher(settings)
    await publisher.connect()
    try:
        payload = {"deal_id": "test", "changes": {"status": "updated"}}
        routing_key = "deal.updated"

        async with api_client.stream("GET", "/streams") as response:
            assert response.status_code == 200

            # Дожидаемся инициализации подписки, чтобы не потерять сообщение.
            await asyncio.sleep(0.1)
            await publisher.publish(routing_key, payload)

            lines = response.aiter_lines()
            event = await asyncio.wait_for(_read_sse_event(lines), timeout=5)

            assert event["event"] == routing_key
            assert json.loads(event["data"]) == payload

            await asyncio.wait_for(response.aclose(), timeout=2)
            assert response.is_closed
    finally:
        await publisher.close()
