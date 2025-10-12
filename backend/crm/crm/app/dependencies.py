from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from crm.app.config import settings
from crm.domain import services
from crm.infrastructure import repositories
from crm.infrastructure.db import AsyncSessionFactory, get_session


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


async def get_db_session() -> AsyncSession:
    async for session in get_session():
        return session
    raise RuntimeError("Database session factory did not yield a session")


async def get_client_service(session: AsyncSession = Depends(get_db_session)) -> services.ClientService:
    return services.ClientService(repositories.ClientRepository(session))


async def get_deal_service(session: AsyncSession = Depends(get_db_session)) -> services.DealService:
    return services.DealService(repositories.DealRepository(session))


async def get_policy_service(session: AsyncSession = Depends(get_db_session)) -> services.PolicyService:
    return services.PolicyService(repositories.PolicyRepository(session))


async def get_task_service(session: AsyncSession = Depends(get_db_session)) -> services.TaskService:
    return services.TaskService(repositories.TaskRepository(session))


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return AsyncSessionFactory
