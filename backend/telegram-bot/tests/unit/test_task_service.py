from __future__ import annotations

from datetime import date
from uuid import UUID, uuid4

import pytest

from telegram_bot.clients.auth import AuthUser
from telegram_bot.clients.crm import Task
from telegram_bot.events.publisher import InMemoryPublisher
from telegram_bot.services.tasks import TaskService


class FakeCRMClient:
    def __init__(self) -> None:
        self.updated: dict[str, object] | None = None

    async def get_task(self, task_id: UUID) -> Task:
        return Task(id=task_id, title="Подготовить КП", status="in_progress", due_date=date.today(), description=None)

    async def update_task_status(
        self, task_id: UUID, *, status: str, description: str | None = None
    ) -> None:
        self.updated = {"task_id": task_id, "status": status, "description": description}


class FakeNotificationsClient:
    def __init__(self) -> None:
        self.calls: list[str] = []

    async def send_event(
        self,
        *,
        event_key: str,
        user_id: UUID,
        payload: dict[str, object],
        deduplication_key: str | None = None,
    ) -> UUID:
        self.calls.append(event_key)
        return uuid4()


@pytest.mark.asyncio
async def test_task_confirmation_publishes_status_change() -> None:
    crm = FakeCRMClient()
    notifications = FakeNotificationsClient()
    publisher = InMemoryPublisher(source="test")
    service = TaskService(crm, notifications, publisher, exchange_tasks="tasks.events")
    user = AuthUser(id=uuid4(), telegram_id=123, roles=["agent"], active=True)

    result = await service.confirm_task(user, uuid4(), comment="Готово", trace_id="trace")

    assert crm.updated is not None
    assert crm.updated["status"] == "done"
    assert len(publisher.published) == 1
    _, event, payload = publisher.published[0]
    assert event.routing_key == "task.status.changed"
    assert payload["data"]["new_status"] == "done"
    assert notifications.calls == ["task.completed"]
    assert result.task.status == "in_progress"
