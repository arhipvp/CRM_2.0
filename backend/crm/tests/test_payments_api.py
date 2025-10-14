import json
import os
from uuid import uuid4

import aio_pika
import pytest

from crm.domain import schemas


async def _declare_events_queue() -> tuple[aio_pika.RobustConnection, aio_pika.abc.AbstractQueue]:
    url = os.environ["CRM_RABBITMQ_URL"]
    connection = await aio_pika.connect_robust(url)
    channel = await connection.channel()
    exchange = await channel.declare_exchange("crm.events", aio_pika.ExchangeType.TOPIC, durable=True)
    queue = await channel.declare_queue(exclusive=True, auto_delete=True)
    await queue.bind(exchange, routing_key="deal.payment.*")
    return connection, queue


async def _next_event(queue: aio_pika.abc.AbstractQueue) -> tuple[str, dict]:
    message = await queue.get(timeout=5)
    async with message.process():
        payload = json.loads(message.body.decode("utf-8"))
        return message.routing_key, payload


@pytest.mark.asyncio()
async def test_payments_crud_and_events(api_client):
    tenant_id = uuid4()
    owner_id = uuid4()
    headers = {"X-Tenant-ID": str(tenant_id)}

    client_payload = {
        "name": "ООО Альфа",
        "email": "alpha@example.com",
        "phone": "+7-900-000-00-00",
        "owner_id": str(owner_id),
    }
    response = await api_client.post("/api/v1/clients/", json=client_payload, headers=headers)
    assert response.status_code == 201
    client = schemas.ClientRead.model_validate(response.json())

    deal_payload = {
        "client_id": str(client.id),
        "title": "КАСКО",
        "description": "Полис КАСКО",
        "owner_id": str(owner_id),
        "value": 150000,
        "next_review_at": "2024-12-31",
    }
    response = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
    assert response.status_code == 201
    deal = schemas.DealRead.model_validate(response.json())

    policy_payload = {
        "client_id": str(client.id),
        "deal_id": str(deal.id),
        "policy_number": "POLICY-1",
        "owner_id": str(owner_id),
        "premium": 150000,
    }
    response = await api_client.post("/api/v1/policies/", json=policy_payload, headers=headers)
    assert response.status_code == 201
    policy = schemas.PolicyRead.model_validate(response.json())

    connection, queue = await _declare_events_queue()
    try:
        payment_payload = {
            "deal_id": str(deal.id),
            "policy_id": str(policy.id),
            "planned_amount": "150000.00",
            "currency": "RUB",
            "owner_id": str(owner_id),
        }
        response = await api_client.post(
            f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments",
            json=payment_payload,
            headers=headers,
        )
        assert response.status_code == 201
        payment = schemas.PaymentRead.model_validate(response.json())
        assert payment.sequence == 1
        assert payment.incomes_total == 0
        assert payment.expenses_total == 0

        created_event = await _next_event(queue)
        updated_event = await _next_event(queue)
        assert created_event[0] == "deal.payment.created"
        assert updated_event[0] == "deal.payment.updated"

        income_payload = {
            "amount": "100000.00",
            "currency": "RUB",
            "category": "wire",
            "posted_at": "2024-01-10",
            "owner_id": str(owner_id),
        }
        response = await api_client.post(
            f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}/incomes",
            json=income_payload,
            headers=headers,
        )
        assert response.status_code == 201
        income = schemas.PaymentIncomeRead.model_validate(response.json())
        assert income.amount == 100000

        income_created = await _next_event(queue)
        income_update = await _next_event(queue)
        assert income_created[0] == "deal.payment.income.created"
        assert income_update[0] == "deal.payment.updated"

        expense_payload = {
            "amount": "10000.00",
            "currency": "RUB",
            "category": "commission",
            "posted_at": "2024-01-12",
            "owner_id": str(owner_id),
        }
        response = await api_client.post(
            f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}/expenses",
            json=expense_payload,
            headers=headers,
        )
        assert response.status_code == 201
        expense = schemas.PaymentExpenseRead.model_validate(response.json())
        assert expense.amount == 10000

        expense_created = await _next_event(queue)
        expense_update = await _next_event(queue)
        assert expense_created[0] == "deal.payment.expense.created"
        assert expense_update[0] == "deal.payment.updated"

        response = await api_client.get(
            f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}",
            params={"include": ["incomes", "expenses"]},
            headers=headers,
        )
        assert response.status_code == 200
        payment_view = schemas.PaymentRead.model_validate(response.json())
        assert payment_view.incomes_total == 100000
        assert payment_view.expenses_total == 10000
        assert payment_view.net_total == 90000
        assert len(payment_view.incomes or []) == 1
        assert len(payment_view.expenses or []) == 1

        delete_expense_resp = await api_client.delete(
            f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}/expenses/{expense.id}",
            headers=headers,
        )
        assert delete_expense_resp.status_code == 204
        expense_deleted = await _next_event(queue)
        expense_totals = await _next_event(queue)
        assert expense_deleted[0] == "deal.payment.expense.deleted"
        assert expense_totals[0] == "deal.payment.updated"

        delete_income_resp = await api_client.delete(
            f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}/incomes/{income.id}",
            headers=headers,
        )
        assert delete_income_resp.status_code == 204
        income_deleted = await _next_event(queue)
        income_totals = await _next_event(queue)
        assert income_deleted[0] == "deal.payment.income.deleted"
        assert income_totals[0] == "deal.payment.updated"

        delete_payment_resp = await api_client.delete(
            f"/api/v1/deals/{deal.id}/policies/{policy.id}/payments/{payment.id}",
            headers=headers,
        )
        assert delete_payment_resp.status_code == 204
        payment_deleted = await _next_event(queue)
        assert payment_deleted[0] == "deal.payment.deleted"
    finally:
        await connection.close()
