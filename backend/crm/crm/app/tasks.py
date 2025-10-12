from __future__ import annotations

import asyncio
from uuid import UUID


from crm.app.celery_app import celery_app
from crm.infrastructure.db import AsyncSessionFactory
from crm.infrastructure.repositories import DealRepository, PolicyRepository


async def _update_deal_status(tenant_id: UUID, deal_id: UUID, status: str) -> None:
    async with AsyncSessionFactory() as session:
        repo = DealRepository(session)
        await repo.update(tenant_id, deal_id, {"status": status})


async def _refresh_policy_status(tenant_id: UUID, policy_id: UUID, status: str) -> None:
    async with AsyncSessionFactory() as session:
        repo = PolicyRepository(session)
        await repo.update(tenant_id, policy_id, {"status": status})


@celery_app.task(bind=True, name="crm.app.tasks.sync_deal_status", autoretry_for=(Exception,), retry_backoff=True)
def sync_deal_status(self, tenant_id: str, deal_id: str, status: str) -> None:
    asyncio.run(_update_deal_status(UUID(tenant_id), UUID(deal_id), status))


@celery_app.task(bind=True, name="crm.app.tasks.refresh_policy_state", autoretry_for=(Exception,), retry_backoff=True)
def refresh_policy_state(self, tenant_id: str, policy_id: str, status: str) -> None:
    asyncio.run(_refresh_policy_status(UUID(tenant_id), UUID(policy_id), status))
