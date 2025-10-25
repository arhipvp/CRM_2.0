from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from telegram_bot.clients.auth import AuthUser
from telegram_bot.clients.crm import CRMClient, Task
from telegram_bot.clients.notifications import NotificationsClient
from telegram_bot.events.publisher import IntegrationEvent, IntegrationEventPublisher


@dataclass(slots=True)
class TaskConfirmationResult:
    task: Task


class TaskService:
    def __init__(
        self,
        crm: CRMClient,
        notifications: NotificationsClient,
        publisher: IntegrationEventPublisher,
        *,
        exchange_tasks: str,
    ) -> None:
        self._crm = crm
        self._notifications = notifications
        self._publisher = publisher
        self._exchange_tasks = exchange_tasks

    async def confirm_task(
        self,
        user: AuthUser,
        task_id: UUID,
        *,
        comment: str | None = None,
        trace_id: str | None = None,
    ) -> TaskConfirmationResult:
        task = await self._crm.get_task(task_id)
        await self._crm.update_task_status(
            task_id,
            status="done",
            description=comment or task.description,
        )
        event = IntegrationEvent(
            routing_key="task.status.changed",
            type="tasks.task.status_changed",
            data={
                "task_id": str(task.id),
                "old_status": task.status,
                "new_status": "done",
                "changed_at": datetime.now(tz=timezone.utc).isoformat(),
            },
            trace_id=trace_id,
        )
        await self._publisher.publish(self._exchange_tasks, event)
        await self._notifications.send_event(
            event_key="task.completed",
            user_id=user.id,
            payload={"taskId": str(task.id), "title": task.title},
            deduplication_key=f"task:{task.id}:done",
        )
        return TaskConfirmationResult(task=task)
