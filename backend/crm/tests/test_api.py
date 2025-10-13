from __future__ import annotations

from datetime import date, timedelta
from uuid import uuid4

import pytest

from crm.domain import schemas


@pytest.mark.asyncio
async def test_crud_flow(api_client):
    tenant_id = uuid4()
    owner_id = uuid4()
    headers = {"X-Tenant-ID": str(tenant_id)}

    client_payload = {
        "name": "ООО Ромашка",
        "email": "info@example.com",
        "phone": "+7-900-123-45-67",
        "owner_id": str(owner_id),
    }
    response = await api_client.post("/api/v1/clients/", json=client_payload, headers=headers)
    assert response.status_code == 201
    client = schemas.ClientRead.model_validate(response.json())

    response = await api_client.get("/api/v1/clients/", headers=headers)
    assert response.status_code == 200
    assert any(item["id"] == str(client.id) for item in response.json())

    deal_payload = {
        "client_id": str(client.id),
        "title": "Каско 2024",
        "description": "Полис каско",
        "owner_id": str(owner_id),
        "value": 120000,
        "next_review_at": (date.today() + timedelta(days=7)).isoformat(),
    }
    response = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
    assert response.status_code == 201
    deal = schemas.DealRead.model_validate(response.json())
    assert deal.next_review_at.isoformat() == deal_payload["next_review_at"]

    policy_payload = {
        "client_id": str(client.id),
        "deal_id": str(deal.id),
        "policy_number": "P-001",
        "owner_id": str(owner_id),
        "premium": 120000,
    }
    response = await api_client.post("/api/v1/policies/", json=policy_payload, headers=headers)
    assert response.status_code == 201
    policy = schemas.PolicyRead.model_validate(response.json())

    task_payload = {
        "title": "Согласовать оплату",
        "description": "Связаться с клиентом",
        "owner_id": str(owner_id),
        "deal_id": str(deal.id),
    }
    response = await api_client.post("/api/v1/tasks/", json=task_payload, headers=headers)
    assert response.status_code == 201
    task = schemas.TaskRead.model_validate(response.json())

    response = await api_client.patch(
        f"/api/v1/tasks/{task.id}", json={"status": "in_progress"}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"

    response = await api_client.get(f"/api/v1/policies/{policy.id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["policy_number"] == "P-001"

    response = await api_client.get(f"/api/v1/deals/{deal.id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["title"] == "Каско 2024"


@pytest.mark.asyncio
async def test_multiple_crud_requests_do_not_close_session(api_client):
    tenant_id = uuid4()
    owner_id = uuid4()
    headers = {"X-Tenant-ID": str(tenant_id)}

    for index in range(2):
        client_payload = {
            "name": f"ООО Ромашка {index}",
            "email": f"info{index}@example.com",
            "phone": "+7-900-123-45-67",
            "owner_id": str(owner_id),
        }
        response = await api_client.post("/api/v1/clients/", json=client_payload, headers=headers)
        assert response.status_code == 201
        client = schemas.ClientRead.model_validate(response.json())

        deal_payload = {
            "client_id": str(client.id),
            "title": f"Каско 2024-{index}",
            "description": "Полис каско",
            "owner_id": str(owner_id),
            "value": 120000 + index,
            "next_review_at": (date.today() + timedelta(days=index + 3)).isoformat(),
        }
        response = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
        assert response.status_code == 201
        deal = schemas.DealRead.model_validate(response.json())
        assert deal.next_review_at.isoformat() == deal_payload["next_review_at"]

        policy_payload = {
            "client_id": str(client.id),
            "deal_id": str(deal.id),
            "policy_number": f"P-{index:03d}",
            "owner_id": str(owner_id),
            "premium": 120000 + index,
        }
        response = await api_client.post("/api/v1/policies/", json=policy_payload, headers=headers)
        assert response.status_code == 201
        policy = schemas.PolicyRead.model_validate(response.json())

        task_payload = {
            "title": f"Согласовать оплату {index}",
            "description": "Связаться с клиентом",
            "owner_id": str(owner_id),
            "deal_id": str(deal.id),
        }
        response = await api_client.post("/api/v1/tasks/", json=task_payload, headers=headers)
        assert response.status_code == 201
        task = schemas.TaskRead.model_validate(response.json())

        response = await api_client.patch(
            f"/api/v1/tasks/{task.id}", json={"status": "in_progress"}, headers=headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "in_progress"

        response = await api_client.get(f"/api/v1/policies/{policy.id}", headers=headers)
        assert response.status_code == 200
        assert response.json()["policy_number"] == f"P-{index:03d}"

        response = await api_client.get(f"/api/v1/deals/{deal.id}", headers=headers)
        assert response.status_code == 200
        assert response.json()["title"] == f"Каско 2024-{index}"
        assert response.json()["next_review_at"] == deal_payload["next_review_at"]


@pytest.mark.asyncio
async def test_deals_sorted_by_next_review(api_client):
    tenant_id = uuid4()
    owner_id = uuid4()
    headers = {"X-Tenant-ID": str(tenant_id)}

    client_payload = {
        "name": "ООО Сортировка",
        "email": "sort@example.com",
        "phone": "+7-900-765-43-21",
        "owner_id": str(owner_id),
    }
    response = await api_client.post("/api/v1/clients/", json=client_payload, headers=headers)
    assert response.status_code == 201
    client = schemas.ClientRead.model_validate(response.json())

    base_date = date.today()
    deals = [
        {"title": "Позже", "delta": 10, "payload": {"status": "draft"}},
        {"title": "Раньше", "delta": 2, "payload": {"status": "draft"}},
        {"title": "В тот же день", "delta": 2, "payload": {"status": "negotiation"}},
    ]

    created_ids: list[str] = []
    for item in deals:
        payload = {
            "client_id": str(client.id),
            "title": item["title"],
            "description": "",
            "owner_id": str(owner_id),
            "value": 1000,
            "status": item["payload"].get("status", "draft"),
            "next_review_at": (base_date + timedelta(days=item["delta"])).isoformat(),
        }
        response = await api_client.post("/api/v1/deals/", json=payload, headers=headers)
        assert response.status_code == 201
        created_ids.append(response.json()["id"])

    # Обновим одну сделку, чтобы у неё было более свежее updated_at при одинаковой дате
    response = await api_client.patch(
        f"/api/v1/deals/{created_ids[1]}",
        json={"status": "won"},
        headers=headers,
    )
    assert response.status_code == 200

    response = await api_client.get("/api/v1/deals/", headers=headers)
    assert response.status_code == 200
    titles_order = [item["title"] for item in response.json()]
    assert titles_order == ["Раньше", "В тот же день", "Позже"]
