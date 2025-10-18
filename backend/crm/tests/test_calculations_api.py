import asyncio
import json
from datetime import date, timedelta
from uuid import uuid4

import aio_pika
import pytest
from sqlalchemy import update

from crm.domain import schemas
from crm.infrastructure import models


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
async def test_calculations_list_sorted_by_updated_at(api_client, configure_environment):
    tenant_id = uuid4()
    headers = {"X-Tenant-ID": str(tenant_id)}

    client_payload = {
        "name": "ООО Альфа",
        "email": "alpha@example.com",
        "phone": "+7-900-000-00-00",
        "owner_id": str(uuid4()),
    }
    client_resp = await api_client.post("/api/v1/clients/", json=client_payload, headers=headers)
    assert client_resp.status_code == 201
    client = schemas.ClientRead.model_validate(client_resp.json())

    deal_payload = {
        "client_id": str(client.id),
        "title": "КАСКО для руководства",
        "description": "Подбор программы",
        "owner_id": str(uuid4()),
        "next_review_at": date.today().isoformat(),
    }
    deal_resp = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
    assert deal_resp.status_code == 201
    deal = schemas.DealRead.model_validate(deal_resp.json())

    validity_start = date.today()
    validity_end = validity_start + timedelta(days=365)

    def build_payload(company: str, program_suffix: str, premium: str, file_name: str, comment: str) -> dict[str, object]:
        return {
            "insurance_company": company,
            "program_name": f"КАСКО {program_suffix}",
            "premium_amount": premium,
            "coverage_sum": "5000000.00",
            "calculation_date": validity_start.isoformat(),
            "validity_period": {
                "start": validity_start.isoformat(),
                "end": validity_end.isoformat(),
            },
            "files": [file_name],
            "comments": comment,
            "owner_id": str(uuid4()),
        }

    calc1_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/calculations",
        json=build_payload("Ингосстрах", "Базовый", "120000.00", "calc-101.pdf", "Первый расчёт"),
        headers=headers,
    )
    assert calc1_resp.status_code == 201
    calc1 = schemas.CalculationRead.model_validate(calc1_resp.json())

    calc2_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/calculations",
        json=build_payload("Росгосстрах", "Стандарт", "130000.00", "calc-102.pdf", "Второй расчёт"),
        headers=headers,
    )
    assert calc2_resp.status_code == 201
    calc2 = schemas.CalculationRead.model_validate(calc2_resp.json())

    calc3_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/calculations",
        json=build_payload("Согласие", "Премиум", "140000.00", "calc-103.pdf", "Третий расчёт"),
        headers=headers,
    )
    assert calc3_resp.status_code == 201
    calc3 = schemas.CalculationRead.model_validate(calc3_resp.json())

    update_resp = await api_client.patch(
        f"/api/v1/deals/{deal.id}/calculations/{calc1.id}",
        json={"comments": "Первый расчёт (обновлён)", "files": ["calc-101.pdf", "calc-101-v2.pdf"]},
        headers=headers,
    )
    assert update_resp.status_code == 200

    list_resp = await api_client.get(f"/api/v1/deals/{deal.id}/calculations", headers=headers)
    assert list_resp.status_code == 200
    items = list_resp.json()
    ids_in_response = [item["id"] for item in items]
    assert ids_in_response == [str(calc1.id), str(calc3.id), str(calc2.id)]


@pytest.mark.asyncio()
async def test_calculation_creation_checks_deal_existence(api_client, db_session):
    tenant_id = uuid4()
    headers = {"X-Tenant-ID": str(tenant_id)}

    client_payload = {
        "name": "ООО Гамма",
        "email": "gamma@example.com",
        "phone": "+7-900-222-33-44",
        "owner_id": str(uuid4()),
    }
    client_resp = await api_client.post("/api/v1/clients/", json=client_payload, headers=headers)
    assert client_resp.status_code == 201
    client = schemas.ClientRead.model_validate(client_resp.json())

    deal_payload = {
        "client_id": str(client.id),
        "title": "КАСКО для топ-менеджера",
        "description": "Подбор оптимальной программы",
        "owner_id": str(uuid4()),
        "next_review_at": date.today().isoformat(),
    }
    deal_resp = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
    assert deal_resp.status_code == 201
    deal = schemas.DealRead.model_validate(deal_resp.json())

    validity_start = date.today()
    validity_end = validity_start + timedelta(days=365)

    def build_payload(prefix: str) -> dict[str, object]:
        return {
            "insurance_company": "Ингосстрах",
            "program_name": f"КАСКО {prefix}",
            "premium_amount": "160000.00",
            "coverage_sum": "6000000.00",
            "calculation_date": validity_start.isoformat(),
            "validity_period": {
                "start": validity_start.isoformat(),
                "end": validity_end.isoformat(),
            },
            "files": [f"calc-{prefix}.pdf"],
            "comments": f"Расчёт {prefix}",
            "owner_id": str(uuid4()),
        }

    success_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/calculations",
        json=build_payload("успешный"),
        headers=headers,
    )
    assert success_resp.status_code == 201

    foreign_headers = {"X-Tenant-ID": str(uuid4())}
    foreign_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/calculations",
        json=build_payload("чужой"),
        headers=foreign_headers,
    )
    assert foreign_resp.status_code == 404
    assert foreign_resp.json()["detail"] == "deal_not_found"

    await db_session.execute(
        update(models.Deal).where(models.Deal.id == deal.id).values(is_deleted=True)
    )
    await db_session.commit()

    deleted_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/calculations",
        json=build_payload("удалённый"),
        headers=headers,
    )
    assert deleted_resp.status_code == 404
    assert deleted_resp.json()["detail"] == "deal_not_found"


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

    forbidden_confirm_update = await api_client.patch(
        f"/api/v1/deals/{deal.id}/calculations/{calculation.id}",
        json={"comments": "Невозможное обновление после подтверждения"},
        headers=headers,
    )
    assert forbidden_confirm_update.status_code == 400
    assert forbidden_confirm_update.json()["detail"] == "calculation_update_forbidden"

    confirmed_after_failed_patch = await api_client.get(
        f"/api/v1/deals/{deal.id}/calculations/{calculation.id}",
        headers=headers,
    )
    assert confirmed_after_failed_patch.status_code == 200
    confirmed_unchanged = schemas.CalculationRead.model_validate(confirmed_after_failed_patch.json())
    assert confirmed_unchanged.comments == confirmed_calc.comments
    assert confirmed_unchanged.status == confirmed_calc.status

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

    forbidden_archived_update = await api_client.patch(
        f"/api/v1/deals/{deal.id}/calculations/{calculation.id}",
        json={"comments": "Невозможное обновление после архивации"},
        headers=headers,
    )
    assert forbidden_archived_update.status_code == 400
    assert forbidden_archived_update.json()["detail"] == "calculation_update_forbidden"

    archived_after_failed_patch = await api_client.get(
        f"/api/v1/deals/{deal.id}/calculations/{calculation.id}",
        headers=headers,
    )
    assert archived_after_failed_patch.status_code == 200
    archived_unchanged = schemas.CalculationRead.model_validate(archived_after_failed_patch.json())
    assert archived_unchanged.comments == archived_calc.comments
    assert archived_unchanged.status == archived_calc.status

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
