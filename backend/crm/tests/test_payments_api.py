from __future__ import annotations

import asyncio
import json
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import aio_pika
import pytest
from sqlalchemy import text

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


async def _prepare_payment(
    api_client,
    configure_environment,
    *,
    currency: str = "RUB",
) -> tuple[dict[str, str], schemas.DealRead, schemas.PolicyRead, schemas.PaymentRead]:
    _ = configure_environment
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
        "title": "КАСКО",
        "description": "Оплата полиса",
        "owner_id": str(uuid4()),
        "next_review_at": date.today().isoformat(),
    }
    deal_resp = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
    assert deal_resp.status_code == 201
    deal = schemas.DealRead.model_validate(deal_resp.json())

    policy_payload = {
        "client_id": str(client.id),
        "deal_id": str(deal.id),
        "policy_number": "POL-001",
        "owner_id": str(uuid4()),
        "premium": 1200,
    }
    policy_resp = await api_client.post("/api/v1/policies/", json=policy_payload, headers=headers)
    assert policy_resp.status_code == 201
    policy = schemas.PolicyRead.model_validate(policy_resp.json())

    payment_payload = {
        "planned_amount": "1000.00",
        "currency": currency,
        "comment": "Аванс",
        "planned_date": date.today().isoformat(),
    }
    payment_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments",
        json=payment_payload,
        headers=headers,
    )
    assert payment_resp.status_code == 201
    payment = schemas.PaymentRead.model_validate(payment_resp.json())

    return headers, deal, policy, payment


@pytest.mark.asyncio()
async def test_payments_flow(api_client, configure_environment):
    settings = configure_environment
    tenant_id = uuid4()
    headers = {"X-Tenant-ID": str(tenant_id)}

    connection = await aio_pika.connect_robust(str(settings.rabbitmq_url))
    channel = await connection.channel()
    exchange = await channel.declare_exchange(settings.events_exchange, aio_pika.ExchangeType.TOPIC, durable=True)
    events_queue = await channel.declare_queue(exclusive=True)
    await events_queue.bind(exchange, routing_key="deal.payment.#")

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
        "title": "КАСКО",
        "description": "Оплата полиса",
        "owner_id": str(uuid4()),
        "next_review_at": date.today().isoformat(),
    }
    deal_resp = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
    assert deal_resp.status_code == 201
    deal = schemas.DealRead.model_validate(deal_resp.json())

    policy_payload = {
        "client_id": str(client.id),
        "deal_id": str(deal.id),
        "policy_number": "POL-001",
        "owner_id": str(uuid4()),
        "premium": 1200,
    }
    policy_resp = await api_client.post("/api/v1/policies/", json=policy_payload, headers=headers)
    assert policy_resp.status_code == 201
    policy = schemas.PolicyRead.model_validate(policy_resp.json())

    payment_payload = {
        "planned_amount": "1000.00",
        "currency": "RUB",
        "comment": "Аванс",
        "planned_date": date.today().isoformat(),
    }
    payment_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments",
        json=payment_payload,
        headers=headers,
    )
    assert payment_resp.status_code == 201
    payment = schemas.PaymentRead.model_validate(payment_resp.json())
    assert payment.status == "scheduled"
    assert payment.incomes_total == 0

    income_payload = {
        "amount": "400.00",
        "currency": "RUB",
        "category": "wire",
        "posted_at": date.today().isoformat(),
    }
    income_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}/incomes",
        json=income_payload,
        headers=headers,
    )
    assert income_resp.status_code == 201

    payment_after_income = await api_client.get(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}",
        headers=headers,
    )
    assert payment_after_income.status_code == 200
    payment_data = schemas.PaymentRead.model_validate(payment_after_income.json())
    assert payment_data.status == "partially_paid"
    assert payment_data.incomes_total == 400

    second_income_payload = {
        "amount": "700.00",
        "currency": "RUB",
        "category": "cash",
        "posted_at": date.today().isoformat(),
    }
    second_income_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}/incomes",
        json=second_income_payload,
        headers=headers,
    )
    assert second_income_resp.status_code == 201

    expense_payload = {
        "amount": "100.00",
        "currency": "RUB",
        "category": "agency_fee",
        "posted_at": date.today().isoformat(),
    }
    expense_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}/expenses",
        json=expense_payload,
        headers=headers,
    )
    assert expense_resp.status_code == 201

    list_resp = await api_client.get(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments",
        params={"include[]": ["incomes", "expenses"]},
        headers=headers,
    )
    assert list_resp.status_code == 200
    collection = schemas.PaymentList.model_validate(list_resp.json())
    assert collection.total == 1
    listed_payment = collection.items[0]
    assert listed_payment.status == "paid"
    assert listed_payment.incomes_total == 1100
    assert listed_payment.expenses_total == 100
    assert listed_payment.net_total == 1000
    assert len(listed_payment.incomes) == 2
    assert len(listed_payment.expenses) == 1

    update_resp = await api_client.patch(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}",
        json={"comment": "Оплата подтверждена"},
        headers=headers,
    )
    assert update_resp.status_code == 200
    updated_payment = schemas.PaymentRead.model_validate(update_resp.json())
    assert updated_payment.comment == "Оплата подтверждена"

    delete_expense_resp = await api_client.delete(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}/expenses/{listed_payment.expenses[0].id}",
        headers=headers,
    )
    assert delete_expense_resp.status_code == 204

    final_payment_resp = await api_client.get(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}",
        params={"include[]": ["incomes", "expenses"]},
        headers=headers,
    )
    assert final_payment_resp.status_code == 200
    final_payment = schemas.PaymentRead.model_validate(final_payment_resp.json())
    assert final_payment.expenses_total == 0
    assert final_payment.net_total == 1100

    delete_payment_resp = await api_client.delete(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}",
        headers=headers,
    )
    assert delete_payment_resp.status_code == 204

    missing_resp = await api_client.get(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}",
        headers=headers,
    )
    assert missing_resp.status_code == 404

    events = await _collect_events(events_queue)
    await channel.close()
    routing_keys = {routing for routing, _ in events}
    assert "deal.payment.created" in routing_keys
    assert "deal.payment.updated" in routing_keys
    assert "deal.payment.income.created" in routing_keys
    assert "deal.payment.expense.created" in routing_keys
    assert "deal.payment.expense.deleted" in routing_keys
    assert "deal.payment.deleted" in routing_keys

    await connection.close()


@pytest.mark.asyncio()
async def test_payments_policy_not_found_scenarios(api_client, configure_environment, db_session):
    tenant_id = uuid4()
    headers = {"X-Tenant-ID": str(tenant_id)}

    client_payload = {
        "name": "ООО Бета",
        "email": "beta@example.com",
        "phone": "+7-901-000-00-00",
        "owner_id": str(uuid4()),
    }
    client_resp = await api_client.post("/api/v1/clients/", json=client_payload, headers=headers)
    assert client_resp.status_code == 201
    client = schemas.ClientRead.model_validate(client_resp.json())

    deal_payload = {
        "client_id": str(client.id),
        "title": "Страхование имущества",
        "description": "Основной договор",
        "owner_id": str(uuid4()),
        "next_review_at": date.today().isoformat(),
    }
    deal_resp = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
    assert deal_resp.status_code == 201
    primary_deal = schemas.DealRead.model_validate(deal_resp.json())

    secondary_deal_payload = deal_payload | {
        "title": "Параллельный договор",
        "description": "Тестовая сделка",
    }
    secondary_deal_resp = await api_client.post(
        "/api/v1/deals/",
        json=secondary_deal_payload,
        headers=headers,
    )
    assert secondary_deal_resp.status_code == 201
    secondary_deal = schemas.DealRead.model_validate(secondary_deal_resp.json())

    policy_payload = {
        "client_id": str(client.id),
        "deal_id": str(primary_deal.id),
        "policy_number": "POL-404",
        "owner_id": str(uuid4()),
        "premium": 2500,
    }
    policy_resp = await api_client.post("/api/v1/policies/", json=policy_payload, headers=headers)
    assert policy_resp.status_code == 201
    policy = schemas.PolicyRead.model_validate(policy_resp.json())

    payments_base_url = f"/api/v1/deals/{primary_deal.id}/policies/{policy.id}/payments"

    foreign_headers = {"X-Tenant-ID": str(uuid4())}
    foreign_resp = await api_client.get(payments_base_url, headers=foreign_headers)
    assert foreign_resp.status_code == 404
    assert foreign_resp.json()["detail"] == "policy_not_found"

    payment_payload = {
        "planned_amount": "500.00",
        "currency": "RUB",
        "planned_date": date.today().isoformat(),
    }
    mismatch_resp = await api_client.post(
        f"/api/v1/deals/{secondary_deal.id}/policies/{policy.id}/payments",
        json=payment_payload,
        headers=headers,
    )
    assert mismatch_resp.status_code == 404
    assert mismatch_resp.json()["detail"] == "policy_not_found"

    await db_session.execute(
        text("UPDATE crm.policies SET is_deleted = true WHERE id = :policy_id"),
        {"policy_id": policy.id},
    )
    await db_session.commit()

    deleted_resp = await api_client.get(payments_base_url, headers=headers)
    assert deleted_resp.status_code == 404
    assert deleted_resp.json()["detail"] == "policy_not_found"
async def test_income_currency_mismatch(api_client, configure_environment):
    headers, deal, policy, payment = await _prepare_payment(api_client, configure_environment)

    income_payload = {
        "amount": "100.00",
        "currency": "USD",
        "category": "wire",
        "posted_at": date.today().isoformat(),
    }

    response = await api_client.post(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}/incomes",
        json=income_payload,
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "currency_mismatch"


@pytest.mark.asyncio()
async def test_expense_posted_at_future(api_client, configure_environment):
    headers, deal, policy, payment = await _prepare_payment(api_client, configure_environment)

    future_date = (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
    expense_payload = {
        "amount": "50.00",
        "currency": payment.currency,
        "category": "agency_fee",
        "posted_at": future_date,
    }

    response = await api_client.post(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}/expenses",
        json=expense_payload,
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "posted_at_in_future"


@pytest.mark.asyncio()
async def test_delete_payment_with_transactions_returns_conflict(api_client, configure_environment):
    headers, deal, policy, payment = await _prepare_payment(api_client, configure_environment)

    income_payload = {
        "amount": "200.00",
        "currency": payment.currency,
        "category": "wire",
        "posted_at": date.today().isoformat(),
    }
    income_resp = await api_client.post(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}/incomes",
        json=income_payload,
        headers=headers,
    )
    assert income_resp.status_code == 201

    delete_response = await api_client.delete(
        f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}",
        headers=headers,
    )

    assert delete_response.status_code == 409
    assert delete_response.json()["detail"] == "payment_has_transactions"
