from __future__ import annotations

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
    }
    response = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
    assert response.status_code == 201
    deal = schemas.DealRead.model_validate(response.json())

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
        }
        response = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
        assert response.status_code == 201
        deal = schemas.DealRead.model_validate(response.json())

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
