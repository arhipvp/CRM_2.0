import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from crm.domain import schemas


@pytest.mark.asyncio
async def test_create_list_and_filter_tasks(api_client):
    assignee_id = uuid4()
    author_id = uuid4()
    due_date = (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat()

    payload = {
        "subject": "Подготовить КП",
        "description": "Согласовать условия",
        "assignee_id": str(assignee_id),
        "author_id": str(author_id),
        "due_date": due_date,
        "priority": "high",
        "context": {"deal_id": str(uuid4())},
    }

    response = await api_client.post("/api/v1/tasks", json=payload)
    assert response.status_code == 201
    task = schemas.TaskRead.model_validate(response.json())
    assert task.status_code == schemas.TaskStatusCode.PENDING
    assert task.priority == schemas.TaskPriority.HIGH

    list_response = await api_client.get(
        "/api/v1/tasks",
        params={"assigneeId": str(assignee_id), "status": "pending"},
    )
    assert list_response.status_code == 200
    items = list_response.json()
    assert any(item["id"] == str(task.id) for item in items)


@pytest.mark.asyncio
async def test_schedule_and_complete_task(api_client):
    subject = "Настроить напоминание"
    payload = {
        "subject": subject,
        "description": "Позвонить клиенту",
        "assignee_id": str(uuid4()),
        "author_id": str(uuid4()),
    }
    response = await api_client.post("/api/v1/tasks", json=payload)
    task = schemas.TaskRead.model_validate(response.json())

    scheduled_for = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    schedule_response = await api_client.post(
        f"/api/v1/tasks/{task.id}/schedule",
        json={"scheduledFor": scheduled_for},
    )
    assert schedule_response.status_code == 200
    scheduled_task = schemas.TaskRead.model_validate(schedule_response.json())
    assert scheduled_task.status_code == schemas.TaskStatusCode.SCHEDULED
    assert scheduled_task.scheduled_for is not None

    complete_response = await api_client.post(f"/api/v1/tasks/{task.id}/complete", json={})
    assert complete_response.status_code == 200
    completed_task = schemas.TaskRead.model_validate(complete_response.json())
    assert completed_task.status_code == schemas.TaskStatusCode.COMPLETED
    assert completed_task.completed_at is not None


@pytest.mark.asyncio
async def test_invalid_transition_returns_conflict(api_client):
    response = await api_client.post(
        "/api/v1/tasks",
        json={
            "subject": "Сверить документы",
            "description": "Проверить комплект",
            "assignee_id": str(uuid4()),
            "author_id": str(uuid4()),
        },
    )
    task = schemas.TaskRead.model_validate(response.json())

    await api_client.post(f"/api/v1/tasks/{task.id}/complete", json={})
    conflict = await api_client.patch(
        f"/api/v1/tasks/{task.id}",
        json={"status": "pending"},
    )
    assert conflict.status_code == 409
    payload = conflict.json()
    assert payload["code"] == "invalid_status_transition"


@pytest.mark.asyncio
async def test_create_reminder_conflict(api_client):
    response = await api_client.post(
        "/api/v1/tasks",
        json={
            "subject": "Отправить КП",
            "description": "Напомнить клиенту",
            "assignee_id": str(uuid4()),
            "author_id": str(uuid4()),
        },
    )
    task = schemas.TaskRead.model_validate(response.json())

    remind_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    reminder_payload = {"remind_at": remind_at, "channel": "sse"}

    create_response = await api_client.post(
        f"/api/v1/tasks/{task.id}/reminders", json=reminder_payload
    )
    assert create_response.status_code == 201

    duplicate_response = await api_client.post(
        f"/api/v1/tasks/{task.id}/reminders", json=reminder_payload
    )
    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["code"] == "task_reminder_conflict"
