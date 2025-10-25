from __future__ import annotations

import asyncio
from uuid import UUID


from crm.app.celery_app import celery_app
from redis.asyncio import Redis

from crm.app.config import settings
from crm.infrastructure.db import AsyncSessionFactory
from crm.infrastructure.repositories import DealRepository, PolicyRepository, TaskReminderRepository
from crm.infrastructure.queues import TaskReminderQueue
from crm.infrastructure.task_events import TaskEventsPublisher
from crm.domain.services import TaskReminderProcessor


async def _update_deal_status(deal_id: UUID, status: str) -> None:
    async with AsyncSessionFactory() as session:
        repo = DealRepository(session)
        await repo.update(deal_id, {"status": status})


async def _refresh_policy_status(policy_id: UUID, status: str) -> None:
    async with AsyncSessionFactory() as session:
        repo = PolicyRepository(session)
        await repo.update(policy_id, {"status": status})


async def _process_reminders() -> int:
    redis = Redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    queue = TaskReminderQueue(redis=redis, queue_key=settings.tasks_reminders_queue_key)
    async with AsyncSessionFactory() as session:
        reminders = TaskReminderRepository(session)
        events = TaskEventsPublisher(settings)
        await events.connect()
        processor = TaskReminderProcessor(
            queue,
            reminders,
            events,
            batch_size=settings.tasks_scheduling_batch_size,
            retry_delay_ms=settings.tasks_reminders_poll_interval_ms,
        )
        try:
            processed = await processor.process_due_reminders()
        finally:
            await events.close()
            await redis.aclose()
    return processed


@celery_app.task(bind=True, name="crm.app.tasks.sync_deal_status", autoretry_for=(Exception,), retry_backoff=True)
def sync_deal_status(self, deal_id: str, status: str) -> None:
    asyncio.run(_update_deal_status(UUID(deal_id), status))


@celery_app.task(bind=True, name="crm.app.tasks.refresh_policy_state", autoretry_for=(Exception,), retry_backoff=True)
def refresh_policy_state(self, policy_id: str, status: str) -> None:
    asyncio.run(_refresh_policy_status(UUID(policy_id), status))


@celery_app.task(
    bind=True,
    name="crm.app.tasks.process_task_reminders",
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def process_task_reminders(self) -> int:
    return asyncio.run(_process_reminders())
