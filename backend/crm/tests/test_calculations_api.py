import asyncio
import json
from datetime import date, timedelta
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
async def test_calculations_flow(api_client, configure_environment):
    settings = configure_environment
    tenant_id = uuid4()
    headers = {"X-Tenant-ID": str(tenant_id)}

    connection = await aio_pika.connect_robust(str(settings.rabbitmq_url))
    channel = await connection.channel()
    exchange = await channel.declare_exchange(settings.events_exchange, aio_pika.ExchangeType.TOPIC, durable=True)
    events_queue = await channel.declare_queue(exclusive=True)
    await events_queue.bind(exchange, routing_key="deal.calculation.#")

    client_payload = {
        "name": "ООО Бета",
        "email": "beta@example.com",
        "phone": "+7-900-111-22-33",
        "owner_id": str(uuid4()),
    }
    client_resp = await api_client.post("/api/v1/clients/", json=client_payload, headers=headers)
    assert client_resp.status_code == 201
    client = schemas.ClientRead.model_validate(client_resp.json())

    deal_payload = {
        "client_id": str(client.id),
        "title": "КАСКО для директора",
        "description": "Подбор программы",
        "owner_id": str(uuid4()),
        "value": 350000,
        "next_review_at": date.today().isoformat(),
    }
    deal_resp = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
    assert deal_resp.status_code == 201
    deal = schemas.DealRead.model_validate(deal_resp.json())

    policy_payload = {
        "client_id": str(client.id),
        "deal_id": str(deal.id),
        "policy_number": "POL-9001",
        "owner_id": str(uuid4()),
        "premium": 200000,
    }
    policy_resp = await api_client.post("/api/v1/policies/", json=policy_payload, headers=headers)
    assert policy_resp.status_code == 201
    policy = schemas.PolicyRead.model_validate(policy_resp.json())

    validity_start = date.today()
    validity_end = validity_start + timedelta(days=365)
    calculation_payload = {
        "insurance_company": "Ингосстрах",
        "program_name": "КАСКО Премиум",
        "premium_amount": "150000.00",
        "coverage_sum": "5000000.00",
        "calculation_date": validity_start.isoformat(),
        "validity_period": {
            "start": validity_start.isoformat(),
            "end": validity_end.isoformat(),
        },
        "files": ["calc-001.pdf"],
        "comments": "Первичный вариант",
        "owner_id": str(uuid4()),
    }
    calc_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/calculations",
        json=calculation_payload,
        headers=headers,
    )
    assert calc_resp.status_code == 201
    calculation = schemas.CalculationRead.model_validate(calc_resp.json())
    assert calculation.status == "draft"
    assert calculation.linked_policy_id is None

    list_resp = await api_client.get(
        f"/api/v1/deals/{deal.id}/calculations",
        params={"status[]": ["draft"]},
        headers=headers,
    )
    assert list_resp.status_code == 200
    items = [schemas.CalculationRead.model_validate(item) for item in list_resp.json()]
    assert len(items) == 1
    assert items[0].id == calculation.id

    update_resp = await api_client.patch(
        f"/api/v1/deals/{deal.id}/calculations/{calculation.id}",
        json={"coverage_sum": "5500000.00", "files": ["calc-001.pdf", "calc-002.pdf"]},
        headers=headers,
    )
    assert update_resp.status_code == 200
    updated_calc = schemas.CalculationRead.model_validate(update_resp.json())
    assert updated_calc.coverage_sum == 5500000
    assert len(updated_calc.files) == 2

    ready_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/calculations/{calculation.id}/status",
        json={"status": "ready"},
        headers=headers,
    )
    assert ready_resp.status_code == 200
    ready_calc = schemas.CalculationRead.model_validate(ready_resp.json())
    assert ready_calc.status == "ready"

    bad_confirm_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/calculations/{calculation.id}/status",
        json={"status": "confirmed", "policy_id": str(uuid4())},
        headers=headers,
    )
    assert bad_confirm_resp.status_code == 400
    assert bad_confirm_resp.json()["detail"] == "policy_not_found"

    confirm_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/calculations/{calculation.id}/status",
        json={"status": "confirmed", "policy_id": str(policy.id)},
        headers=headers,
    )
    assert confirm_resp.status_code == 200
    confirmed_calc = schemas.CalculationRead.model_validate(confirm_resp.json())
    assert confirmed_calc.status == "confirmed"
    assert confirmed_calc.linked_policy_id == policy.id

    policy_after_confirm = await api_client.get(
        f"/api/v1/policies/{policy.id}",
        headers=headers,
    )
    assert policy_after_confirm.status_code == 200
    policy_data = schemas.PolicyRead.model_validate(policy_after_confirm.json())
    assert policy_data.calculation_id == calculation.id

    archive_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/calculations/{calculation.id}/status",
        json={"status": "archived"},
        headers=headers,
    )
    assert archive_resp.status_code == 200
    archived_calc = schemas.CalculationRead.model_validate(archive_resp.json())
    assert archived_calc.status == "archived"
    assert archived_calc.linked_policy_id is None

    policy_after_archive = await api_client.get(
        f"/api/v1/policies/{policy.id}",
        headers=headers,
    )
    assert policy_after_archive.status_code == 200
    archived_policy = schemas.PolicyRead.model_validate(policy_after_archive.json())
    assert archived_policy.calculation_id is None

    delete_resp = await api_client.delete(
        f"/api/v1/deals/{deal.id}/calculations/{calculation.id}",
        headers=headers,
    )
    assert delete_resp.status_code == 204

    empty_list_resp = await api_client.get(
        f"/api/v1/deals/{deal.id}/calculations",
        headers=headers,
    )
    assert empty_list_resp.status_code == 200
    assert empty_list_resp.json() == []

    events = await _collect_events(events_queue)
    await channel.close()
    await connection.close()

    routing_keys = {routing for routing, _ in events}
    assert "deal.calculation.created" in routing_keys
    assert "deal.calculation.updated" in routing_keys
    assert "deal.calculation.status.ready" in routing_keys
    assert "deal.calculation.status.confirmed" in routing_keys
    assert "deal.calculation.status.archived" in routing_keys
    assert "deal.calculation.deleted" in routing_keys
