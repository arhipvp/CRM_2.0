from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID, uuid4

import pytest

from crm.domain import schemas
from crm.infrastructure.models import PermissionSyncJob
from sqlalchemy import select


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
        "next_review_at": date.today().isoformat(),
    }
    response = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
    assert response.status_code == 201
    deal = schemas.DealRead.model_validate(response.json())
    assert response.json()["next_review_at"] == deal_payload["next_review_at"]
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
    assert response.json()["next_review_at"] == deal_payload["next_review_at"]


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
            "next_review_at": (date.today() + timedelta(days=index)).isoformat(),
        }
        response = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
        assert response.status_code == 201
        deal = schemas.DealRead.model_validate(response.json())
        assert response.json()["next_review_at"] == deal_payload["next_review_at"]

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
async def test_deal_patch_next_review_at_validation(api_client):
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

    deal_payload = {
        "client_id": str(client.id),
        "title": "Каско 2024",
        "description": "Полис каско",
        "owner_id": str(owner_id),
        "next_review_at": date.today().isoformat(),
    }
    response = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
    assert response.status_code == 201
    deal = schemas.DealRead.model_validate(response.json())

    patch_payload = {"status": "won"}
    response = await api_client.patch(
        f"/api/v1/deals/{deal.id}", json=patch_payload, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["next_review_at"] == deal_payload["next_review_at"]

    response = await api_client.patch(
        f"/api/v1/deals/{deal.id}", json={"next_review_at": None}, headers=headers
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_permissions_sync_endpoint(api_client, db_session):
    tenant_id = uuid4()
    headers = {"X-Tenant-ID": str(tenant_id)}
    owner_id = uuid4()
    user_one = uuid4()
    user_two = uuid4()

    payload = {
        "owner_type": "deal",
        "owner_id": str(owner_id),
        "users": [
            {"user_id": str(user_one), "role": "viewer"},
            {"user_id": str(user_two), "role": "editor"},
        ],
    }

    response = await api_client.post("/api/v1/permissions/sync", json=payload, headers=headers)

    assert response.status_code == 202
    body = response.json()
    assert UUID(body["job_id"])  # valid uuid
    assert body["status"] == "queued"

    result = await db_session.execute(
        select(PermissionSyncJob).where(PermissionSyncJob.id == UUID(body["job_id"]))
    )
    job = result.scalars().first()
    assert job is not None
    assert job.owner_id == owner_id
    assert job.owner_type == "deal"
    assert len(job.users) == 2
