import asyncio
import json
from uuid import uuid4

import aio_pika
import pytest

from crm.domain import schemas


async def _collect_events(queue: aio_pika.abc.AbstractQueue) -> list[tuple[str, dict[str, object]]]:
    events: list[tuple[str, dict[str, object]]] = []
    while True:
        try:
            message = await asyncio.wait_for(queue.get(), timeout=1)
        except asyncio.TimeoutError:
            break
        payload = json.loads(message.body.decode("utf-8"))
        events.append((message.routing_key, payload))
        await message.ack()
    return events


@pytest.mark.asyncio()
async def test_deal_journal_flow(api_client, configure_environment):
    settings = configure_environment
    tenant_id = uuid4()
    headers = {"X-Tenant-ID": str(tenant_id)}

    connection = await aio_pika.connect_robust(str(settings.rabbitmq_url))
    channel = await connection.channel()
    exchange = await channel.declare_exchange(
        settings.events_exchange,
        aio_pika.ExchangeType.TOPIC,
        durable=True,
    )
    events_queue = await channel.declare_queue(exclusive=True)
    await events_queue.bind(exchange, routing_key="deal.journal.#")

    owner_id = uuid4()
    client_payload = {
        "name": "ООО Вектор",
        "email": "vector@example.com",
        "phone": "+7-900-700-00-01",
        "owner_id": str(owner_id),
    }
    client_resp = await api_client.post("/api/v1/clients/", json=client_payload, headers=headers)
    assert client_resp.status_code == 201
    client = schemas.ClientRead.model_validate(client_resp.json())

    deal_payload = {
        "client_id": str(client.id),
        "title": "КАСКО 2025",
        "description": "Обсуждение условий",
        "owner_id": str(owner_id),
        "value": 150000,
        "next_review_at": "2025-01-10",
    }
    deal_resp = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
    assert deal_resp.status_code == 201
    deal = schemas.DealRead.model_validate(deal_resp.json())

    list_resp = await api_client.get(f"/api/v1/deals/{deal.id}/journal", headers=headers)
    assert list_resp.status_code == 200
    empty_collection = schemas.DealJournalEntryList.model_validate(list_resp.json())
    assert empty_collection.total == 0
    assert empty_collection.items == []

    entry_payload = {
        "author_id": str(owner_id),
        "body": "Запланировали встречу с клиентом",
    }
    entry_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/journal",
        json=entry_payload,
        headers=headers,
    )
    assert entry_resp.status_code == 201
    first_entry = schemas.DealJournalEntryRead.model_validate(entry_resp.json())
    assert first_entry.body == entry_payload["body"]

    second_payload = {
        "author_id": str(uuid4()),
        "body": "Получили документы для расчёта",
    }
    second_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/journal",
        json=second_payload,
        headers=headers,
    )
    assert second_resp.status_code == 201
    second_entry = schemas.DealJournalEntryRead.model_validate(second_resp.json())

    list_after_resp = await api_client.get(f"/api/v1/deals/{deal.id}/journal", headers=headers)
    assert list_after_resp.status_code == 200
    collection = schemas.DealJournalEntryList.model_validate(list_after_resp.json())
    assert collection.total == 2
    assert [item.id for item in collection.items] == [first_entry.id, second_entry.id]

    paged_resp = await api_client.get(
        f"/api/v1/deals/{deal.id}/journal",
        params={"limit": 1, "offset": 1},
        headers=headers,
    )
    assert paged_resp.status_code == 200
    paged_collection = schemas.DealJournalEntryList.model_validate(paged_resp.json())
    assert paged_collection.total == 2
    assert len(paged_collection.items) == 1
    assert paged_collection.items[0].id == second_entry.id

    events = await _collect_events(events_queue)
    await channel.close()
    await connection.close()

    appended_events = [payload for routing, payload in events if routing == "deal.journal.appended"]
    assert len(appended_events) == 2
    for payload in appended_events:
        assert payload["tenant_id"] == str(tenant_id)
        assert payload["deal_id"] == str(deal.id)
        assert "entry_id" in payload
        assert payload["body"] in {entry_payload["body"], second_payload["body"]}
