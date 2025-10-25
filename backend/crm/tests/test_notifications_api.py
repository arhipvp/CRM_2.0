import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import pytest


@pytest.mark.asyncio
async def test_notification_templates(api_client):
    template_payload = {
        "key": "welcome",
        "channel": "sse",
        "body": "Hello, {{name}}",
        "metadata": {"category": "greeting"},
    }
    create_response = await api_client.post("/api/v1/templates", json=template_payload)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["key"] == template_payload["key"]
    assert created["channel"] == template_payload["channel"]
    duplicate_response = await api_client.post("/api/v1/templates", json=template_payload)
    assert duplicate_response.status_code == 409

    list_response = await api_client.get("/api/v1/templates")
    assert list_response.status_code == 200
    templates = list_response.json()
    assert any(item["id"] == created["id"] for item in templates)


@pytest.mark.asyncio
async def test_notifications_flow(api_client):
    notification_payload = {
        "eventKey": "deal.created",
        "recipients": [
            {
                "userId": "user-1",
                "telegramId": "123456",
            }
        ],
        "payload": {"dealId": "deal-1", "title": "Test Deal"},
        "channelOverrides": ["telegram"],
        "deduplicationKey": "test-dedup",
    }
    response = await api_client.post("/api/v1/notifications", json=notification_payload)
    assert response.status_code == 202
    data = response.json()
    notification_id = data["notification_id"]

    status_response = await api_client.get(f"/api/v1/notifications/{notification_id}")
    assert status_response.status_code == 200
    status_payload = status_response.json()
    assert status_payload["status"] == "processed"
    assert status_payload["attempts"] == 3
    assert set(status_payload["channels"]) == {"rabbitmq", "redis", "events-service"}

    duplicate = await api_client.post("/api/v1/notifications", json=notification_payload)
    assert duplicate.status_code == 409

    event_payload = {
        "id": str(uuid4()),
        "source": "integration-test",
        "type": "notifications.telegram.delivery",
        "time": datetime.now(timezone.utc).isoformat(),
        "data": {"notificationId": notification_id, "status": "delivered"},
        "chatId": "123456",
    }
    ingest_response = await api_client.post("/api/notifications/events", json=event_payload)
    assert ingest_response.status_code == 202
    ingest_again = await api_client.post("/api/notifications/events", json=event_payload)
    assert ingest_again.status_code == 202

    # Give some time for asynchronous updates
    await asyncio.sleep(0.1)
    updated_status = await api_client.get(f"/api/v1/notifications/{notification_id}")
    assert updated_status.status_code == 200
    updated_payload = updated_status.json()
    assert updated_payload["status"] in {"processed", "delivered"}
    assert updated_payload["attempts"] >= 3
