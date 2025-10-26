from __future__ import annotations

from datetime import date, datetime
from uuid import UUID, uuid4

import pytest

from telegram_bot.clients.auth import AuthUser
from telegram_bot.clients.crm import Task
from telegram_bot.events.publisher import InMemoryPublisher
from telegram_bot.services.tasks import TaskService


class FakeCRMClient:
    def __init__(self) -> None:
        self.completed: dict[str, object] | None = None

    async def get_task(self, task_id: UUID) -> Task:
        return Task(id=task_id, title="Подготовить КП", status="in_progress", due_date=date.today(), description=None)

    async def complete_task(self, task_id: UUID, *, completed_at: datetime | None = None) -> None:
        self.completed = {"task_id": task_id, "completed_at": completed_at}


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

    assert crm.completed is not None
    assert len(publisher.published) == 1
    _, event, payload = publisher.published[0]
    assert event.routing_key == "task.status.changed"
    assert payload["data"]["new_status"] == "completed"
    assert notifications.calls == ["task.completed"]
    assert result.task.status == "completed"
