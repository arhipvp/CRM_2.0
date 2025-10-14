from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from redis.asyncio import Redis

from crm.app.config import settings
from crm.domain import services
from crm.infrastructure import repositories
from crm.infrastructure.events import DomainEventPublisher
from crm.infrastructure.queues import PermissionsQueue
from crm.infrastructure.db import AsyncSessionFactory


TenantHeader = Annotated[str | None, Header(alias="X-Tenant-ID")]


async def get_tenant_id(header: TenantHeader = None) -> UUID:
    if header:
        try:
            return UUID(header)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid X-Tenant-ID header") from exc
    if settings.default_tenant_id:
        return UUID(settings.default_tenant_id)
    raise HTTPException(status_code=400, detail="Tenant scope is required")


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionFactory() as session:
        yield session


async def get_client_service(session: AsyncSession = Depends(get_db_session)) -> services.ClientService:
    return services.ClientService(repositories.ClientRepository(session))


async def get_deal_service(session: AsyncSession = Depends(get_db_session)) -> services.DealService:
    return services.DealService(repositories.DealRepository(session))


async def get_policy_service(session: AsyncSession = Depends(get_db_session)) -> services.PolicyService:
    return services.PolicyService(repositories.PolicyRepository(session))


async def get_task_service(session: AsyncSession = Depends(get_db_session)) -> services.TaskService:
    return services.TaskService(repositories.TaskRepository(session))


_events_publisher: DomainEventPublisher | None = None


def get_events_publisher() -> DomainEventPublisher:
    global _events_publisher
    if _events_publisher is None:
        _events_publisher = DomainEventPublisher()
    return _events_publisher


async def get_payment_service(
    session: AsyncSession = Depends(get_db_session),
) -> services.PaymentService:
    return services.PaymentService(
        repositories.PaymentRepository(session),
        repositories.PaymentIncomeRepository(session),
        repositories.PaymentExpenseRepository(session),
        get_events_publisher(),
    )


async def get_payment_income_service(
    session: AsyncSession = Depends(get_db_session),
) -> services.PaymentIncomeService:
    return services.PaymentIncomeService(
        repositories.PaymentIncomeRepository(session),
        repositories.PaymentRepository(session),
        repositories.PaymentExpenseRepository(session),
        get_events_publisher(),
    )


async def get_payment_expense_service(
    session: AsyncSession = Depends(get_db_session),
) -> services.PaymentExpenseService:
    return services.PaymentExpenseService(
        repositories.PaymentExpenseRepository(session),
        repositories.PaymentRepository(session),
        repositories.PaymentIncomeRepository(session),
        get_events_publisher(),
    )


_permissions_queue: PermissionsQueue | None = None


def get_permissions_queue() -> PermissionsQueue:
    global _permissions_queue
    if _permissions_queue is None:
        redis = Redis.from_url(settings.resolved_permissions_redis, encoding="utf-8", decode_responses=True)
        _permissions_queue = PermissionsQueue(
            redis=redis,
            queue_name=settings.permissions_queue_name,
            prefix=settings.permissions_queue_prefix,
            job_name=settings.permissions_job_name,
        )
    return _permissions_queue


async def close_permissions_queue() -> None:
    global _permissions_queue
    if _permissions_queue is not None:
        await _permissions_queue.close()
        _permissions_queue = None


async def get_permissions_service(
    session: AsyncSession = Depends(get_db_session),
) -> services.PermissionSyncService:
    queue = get_permissions_queue()
    repository = repositories.PermissionSyncJobRepository(session)
    return services.PermissionSyncService(repository, queue, settings.permissions_queue_name)


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return AsyncSessionFactory
