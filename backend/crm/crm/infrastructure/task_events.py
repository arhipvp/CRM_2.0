from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import aio_pika
from aio_pika import ExchangeType, Message
from aio_pika.abc import AbstractChannel, AbstractExchange, AbstractRobustConnection

from crm.app.config import Settings
from crm.domain import schemas
from crm.infrastructure import models


class TaskEventsPublisher:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._connection: AbstractRobustConnection | None = None
        self._channel: AbstractChannel | None = None
        self._exchange: AbstractExchange | None = None
        self._lock = asyncio.Lock()
        self._logger = logging.getLogger(self.__class__.__name__)

    @property
    def _routing_keys(self) -> dict[str, str]:
        return self._settings.tasks_events_routing_keys

    async def connect(self) -> None:
        if self._exchange is not None:
            return
        async with self._lock:
            if self._exchange is not None:
                return
            self._connection = await aio_pika.connect_robust(str(self._settings.rabbitmq_url))
            self._channel = await self._connection.channel(publisher_confirms=True)
            self._exchange = await self._channel.declare_exchange(
                self._settings.tasks_events_exchange, ExchangeType.TOPIC, durable=True
            )

    async def close(self) -> None:
        async with self._lock:
            exchange = self._exchange
            channel = self._channel
            connection = self._connection
            self._exchange = None
            self._channel = None
            self._connection = None
        if channel is not None:
            await channel.close()
        if connection is not None:
            await connection.close()

    async def task_created(self, task: models.Task) -> None:
        await self._publish(
            self._routing_keys.get("task_created", "task.created"),
            "tasks.task.created",
            self._map_task_created(task),
        )

    async def task_status_changed(
        self, task: models.Task, previous_status: schemas.TaskStatusCode
    ) -> None:
        if previous_status.value == task.status_code:
            return
        await self._publish(
            self._routing_keys.get("task_status_changed", "task.status.changed"),
            "tasks.task.status_changed",
            self._map_task_status_changed(task, previous_status),
        )

    async def task_reminder(self, reminder: models.TaskReminder) -> None:
        await self._publish(
            self._routing_keys.get("task_reminder", "task.reminder"),
            "tasks.task.reminder",
            {
                "task_id": str(reminder.task_id),
                "remind_at": reminder.remind_at.astimezone(timezone.utc).isoformat(),
                "channel": reminder.channel,
            },
        )

    async def _publish(self, routing_key: str, event_type: str, data: dict[str, Any]) -> None:
        try:
            await self.connect()
            assert self._exchange is not None
            event = self._create_event(event_type, data)
            message = Message(
                body=json.dumps(event, ensure_ascii=False, default=str).encode("utf-8"),
                content_type="application/cloudevents+json",
                headers={"ce-specversion": "1.0"},
            )
            await self._exchange.publish(message, routing_key=routing_key)
        except Exception as exc:  # noqa: BLE001
            self._logger.warning("Failed to publish %s: %s", event_type, exc)

    def _create_event(self, event_type: str, data: dict[str, Any]) -> dict[str, Any]:
        return {
            "specversion": "1.0",
            "id": str(uuid4()),
            "source": self._settings.tasks_events_source,
            "type": event_type,
            "time": datetime.now(timezone.utc).isoformat(),
            "datacontenttype": "application/json",
            "data": data,
        }

    def _map_task_created(self, task: models.Task) -> dict[str, Any]:
        payload = dict(task.payload or {})
        return {
            "task_id": str(task.id),
            "subject": task.title,
            "assignee_id": self._extract_string(payload, ["assigneeId", "assignee_id"]),
            "author_id": self._extract_string(payload, ["authorId", "author_id"]),
            "due_date": task.due_at.astimezone(timezone.utc).isoformat() if task.due_at else None,
            "scheduled_for": task.scheduled_for.astimezone(timezone.utc).isoformat()
            if task.scheduled_for
            else None,
            "status": task.status_code,
            "context": self._extract_context(payload),
        }

    def _map_task_status_changed(
        self, task: models.Task, previous_status: schemas.TaskStatusCode
    ) -> dict[str, Any]:
        changed_at = task.updated_at or datetime.now(timezone.utc)
        return {
            "task_id": str(task.id),
            "old_status": previous_status.value,
            "new_status": task.status_code,
            "changed_at": changed_at.astimezone(timezone.utc).isoformat(),
        }

    def _extract_string(self, payload: dict[str, Any], keys: list[str]) -> str | None:
        for key in keys:
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    def _extract_context(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        context_value = payload.get("context")
        context: dict[str, Any] = {}
        if isinstance(context_value, dict):
            for key, value in context_value.items():
                if isinstance(key, str):
                    context[self._to_snake_case(key)] = value
        for alias, target in (("dealId", "deal_id"), ("clientId", "client_id"), ("policyId", "policy_id")):
            extracted = self._extract_string(payload, [alias, target])
            if extracted:
                context[target] = extracted
        return context or None

    def _to_snake_case(self, value: str) -> str:
        value = value.strip()
        snake = re.sub(r"([A-Z]+)", r"_\1", value).replace("-", "_").replace(" ", "_")
        snake = re.sub(r"_{2,}", "_", snake)
        return snake.lower().lstrip("_")
