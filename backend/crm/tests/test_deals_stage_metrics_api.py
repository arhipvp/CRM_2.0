from datetime import date
from uuid import uuid4

import pytest

from crm.domain import schemas


@pytest.mark.asyncio()
async def test_update_deal_stage_and_metrics(api_client):
    owner_id = uuid4()
    headers = {}

    client_payload = {
        "name": "ООО Вектор",
        "email": "vector@example.com",
        "phone": "+7-900-111-22-33",
        "owner_id": str(owner_id),
    }
    client_resp = await api_client.post("/api/v1/clients/", json=client_payload, headers=headers)
    assert client_resp.status_code == 201
    client = schemas.ClientRead.model_validate(client_resp.json())

    stages = ["qualification", "negotiation", "proposal", "closedWon", "closedLost"]
    deals: list[schemas.DealRead] = []

    for index, stage in enumerate(stages):
        deal_payload = {
            "client_id": str(client.id),
            "title": f"Сделка {index + 1}",
            "description": "Тестовая сделка",
            "owner_id": str(owner_id),
            "next_review_at": (date.today()).isoformat(),
        }
        deal_resp = await api_client.post("/api/v1/deals/", json=deal_payload, headers=headers)
        assert deal_resp.status_code == 201
        deal = schemas.DealRead.model_validate(deal_resp.json())

        if stage != "qualification":
            stage_resp = await api_client.patch(
                f"/api/v1/deals/{deal.id}/stage",
                json={"stage": stage},
                headers=headers,
            )
            assert stage_resp.status_code == 200
            stage_payload = stage_resp.json()
            deal = schemas.DealRead.model_validate(stage_payload)
            assert deal.stage == stage
            if stage == "closedWon":
                assert stage_payload["status"] == "won"
            if stage == "closedLost":
                assert stage_payload["status"] == "lost"

        deals.append(deal)

    closed_won_deal = next(item for item in deals if item.stage == "closedWon")

    policy_payload = {
        "client_id": str(client.id),
        "deal_id": str(closed_won_deal.id),
        "policy_number": "POL-TEST-001",
        "owner_id": str(owner_id),
        "premium": 125000,
    }
    policy_resp = await api_client.post("/api/v1/policies/", json=policy_payload, headers=headers)
    assert policy_resp.status_code == 201
    policy = schemas.PolicyRead.model_validate(policy_resp.json())

    payment_payload = {
        "planned_amount": "150000.00",
        "currency": "RUB",
        "planned_date": date.today().isoformat(),
        "comment": "Первый платёж",
    }
    payment_resp = await api_client.post(
        f"/api/v1/deals/{closed_won_deal.id}/policies/{policy.id}/payments",
        json=payment_payload,
        headers=headers,
    )
    assert payment_resp.status_code == 201

    metrics_resp = await api_client.get("/api/v1/deals/stage-metrics", headers=headers)
    assert metrics_resp.status_code == 200
    metrics = metrics_resp.json()
    assert len(metrics) == 5

    closed_won_metrics = next(item for item in metrics if item["stage"] == "closedWon")
    assert closed_won_metrics["count"] == 1
    assert closed_won_metrics["total_value"] >= 150000

    filtered_resp = await api_client.get(
        "/api/v1/deals/stage-metrics",
        params={"stage": "closedWon"},
        headers=headers,
    )
    assert filtered_resp.status_code == 200
    filtered = filtered_resp.json()
    assert len(filtered) == 5
    for metric in filtered:
        if metric["stage"] == "closedWon":
            assert metric["count"] == 1
        else:
            assert metric["count"] == 0
