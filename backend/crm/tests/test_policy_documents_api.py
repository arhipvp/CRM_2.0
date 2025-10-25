from datetime import date
from uuid import uuid4

import pytest

from crm.domain import schemas


@pytest.mark.asyncio
async def test_policy_documents_flow(api_client, document_id):
    owner_id = uuid4()
    headers = {}

    client_payload = {
        "name": "Документ клиент",
        "email": "policy-doc@example.com",
        "phone": "+7-900-111-22-33",
        "owner_id": str(owner_id),
    }
    client_resp = await api_client.post("/api/v1/clients/", json=client_payload, headers=headers)
    assert client_resp.status_code == 201
    client = schemas.ClientRead.model_validate(client_resp.json())

    policy_payload = {
        "client_id": str(client.id),
        "policy_number": "DOC-1001",
        "owner_id": str(owner_id),
        "premium": 55000,
        "effective_from": date.today().isoformat(),
        "effective_to": date.today().isoformat(),
    }
    policy_resp = await api_client.post("/api/v1/policies/", json=policy_payload, headers=headers)
    assert policy_resp.status_code == 201
    policy = schemas.PolicyRead.model_validate(policy_resp.json())

    attach_resp = await api_client.post(
        f"/api/v1/policies/{policy.id}/documents",
        json={"document_id": str(document_id)},
        headers=headers,
    )
    assert attach_resp.status_code == 201
    policy_document = schemas.PolicyDocumentRead.model_validate(attach_resp.json())
    assert policy_document.document_id == document_id
    assert policy_document.policy_id == policy.id

    list_resp = await api_client.get(f"/api/v1/policies/{policy.id}/documents", headers=headers)
    assert list_resp.status_code == 200
    items = [schemas.PolicyDocumentRead.model_validate(item) for item in list_resp.json()]
    assert len(items) == 1
    assert items[0].document_id == document_id

    duplicate_resp = await api_client.post(
        f"/api/v1/policies/{policy.id}/documents",
        json={"document_id": str(document_id)},
        headers=headers,
    )
    assert duplicate_resp.status_code == 409
    assert duplicate_resp.json()["detail"] == "document_already_linked"

    delete_resp = await api_client.delete(
        f"/api/v1/policies/{policy.id}/documents/{document_id}",
        headers=headers,
    )
    assert delete_resp.status_code == 204

    list_after_delete = await api_client.get(
        f"/api/v1/policies/{policy.id}/documents",
        headers=headers,
    )
    assert list_after_delete.status_code == 200
    assert list_after_delete.json() == []

    missing_delete = await api_client.delete(
        f"/api/v1/policies/{policy.id}/documents/{document_id}",
        headers=headers,
    )
    assert missing_delete.status_code == 404
    assert missing_delete.json()["detail"] == "document_not_linked"

    reattach_resp = await api_client.post(
        f"/api/v1/policies/{policy.id}/documents",
        json={"document_id": str(document_id)},
        headers=headers,
    )
    assert reattach_resp.status_code == 201
    reattached = schemas.PolicyDocumentRead.model_validate(reattach_resp.json())
    assert reattached.document_id == document_id
    assert reattached.policy_id == policy.id

    final_list = await api_client.get(f"/api/v1/policies/{policy.id}/documents", headers=headers)
    assert final_list.status_code == 200
    final_items = [schemas.PolicyDocumentRead.model_validate(item) for item in final_list.json()]
    assert len(final_items) == 1
    assert final_items[0].document_id == document_id

    final_delete = await api_client.delete(
        f"/api/v1/policies/{policy.id}/documents/{document_id}",
        headers=headers,
    )
    assert final_delete.status_code == 204


@pytest.mark.asyncio
async def test_policy_documents_policy_not_found(api_client):
    headers = {}

    list_resp = await api_client.get(
        f"/api/v1/policies/{uuid4()}/documents",
        headers=headers,
    )
    assert list_resp.status_code == 404
    assert list_resp.json()["detail"] == "policy_not_found"

    attach_resp = await api_client.post(
        f"/api/v1/policies/{uuid4()}/documents",
        json={"document_id": str(uuid4())},
        headers=headers,
    )
    assert attach_resp.status_code == 404
    assert attach_resp.json()["detail"] == "policy_not_found"

    delete_resp = await api_client.delete(
        f"/api/v1/policies/{uuid4()}/documents/{uuid4()}",
        headers=headers,
    )
    assert delete_resp.status_code == 404
    assert delete_resp.json()["detail"] == "policy_not_found"
