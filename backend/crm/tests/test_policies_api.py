from datetime import date, timedelta
from uuid import uuid4

import pytest

from crm.domain import schemas


@pytest.mark.asyncio
async def test_policy_get_and_patch(api_client):
    tenant_id = uuid4()
    owner_id = uuid4()
    headers = {"X-Tenant-ID": str(tenant_id)}

    client_payload = {
        "name": "Тестовый клиент",
        "email": "client@example.com",
        "phone": "+7-900-000-00-00",
        "owner_id": str(owner_id),
    }
    client_resp = await api_client.post("/api/v1/clients/", json=client_payload, headers=headers)
    assert client_resp.status_code == 201
    client = schemas.ClientRead.model_validate(client_resp.json())

    deal_payload = {
        "client_id": str(client.id),
        "title": "Полис страхования",
        "description": "Первичный полис",
        "owner_id": str(owner_id),
        "value": 100000,
        "next_review_at": date.today().isoformat(),
    }
    deal_resp = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
    assert deal_resp.status_code == 201
    deal = schemas.DealRead.model_validate(deal_resp.json())

    policy_payload = {
        "client_id": str(client.id),
        "deal_id": str(deal.id),
        "policy_number": "PL-100",
        "owner_id": str(owner_id),
        "premium": 100000,
    }
    create_resp = await api_client.post("/api/v1/policies/", json=policy_payload, headers=headers)
    assert create_resp.status_code == 201
    policy = schemas.PolicyRead.model_validate(create_resp.json())

    get_resp = await api_client.get(f"/api/v1/policies/{policy.id}", headers=headers)
    assert get_resp.status_code == 200
    fetched_policy = schemas.PolicyRead.model_validate(get_resp.json())
    assert fetched_policy.id == policy.id
    assert fetched_policy.policy_number == policy_payload["policy_number"]

    patch_payload = {
        "status": "active",
        "premium": 120500,
        "effective_from": date.today().isoformat(),
        "effective_to": (date.today() + timedelta(days=365)).isoformat(),
    }
    patch_resp = await api_client.patch(
        f"/api/v1/policies/{policy.id}", json=patch_payload, headers=headers
    )
    assert patch_resp.status_code == 200
    updated_policy = schemas.PolicyRead.model_validate(patch_resp.json())
    assert updated_policy.status == patch_payload["status"]
    assert updated_policy.premium == patch_payload["premium"]
    assert updated_policy.effective_from.isoformat() == patch_payload["effective_from"]
    assert updated_policy.effective_to.isoformat() == patch_payload["effective_to"]

    verify_resp = await api_client.get(f"/api/v1/policies/{policy.id}", headers=headers)
    assert verify_resp.status_code == 200
    persisted_policy = schemas.PolicyRead.model_validate(verify_resp.json())
    assert persisted_policy.status == patch_payload["status"]
    assert persisted_policy.premium == patch_payload["premium"]
    assert persisted_policy.effective_from.isoformat() == patch_payload["effective_from"]
    assert persisted_policy.effective_to.isoformat() == patch_payload["effective_to"]
