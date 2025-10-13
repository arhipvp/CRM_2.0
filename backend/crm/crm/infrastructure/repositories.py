from __future__ import annotations

from collections.abc import Iterable
from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from crm.domain import schemas
from crm.infrastructure import models


ModelType = TypeVar("ModelType", bound=models.CRMBase)


class RepositoryError(RuntimeError):
    pass


class BaseRepository(Generic[ModelType]):
    model: type[ModelType]

    def __init__(self, session: AsyncSession):
        self.session = session

    async def list(self, tenant_id: UUID) -> Iterable[ModelType]:
        stmt = select(self.model).where(self.model.tenant_id == tenant_id, self.model.is_deleted.is_(False))
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get(self, tenant_id: UUID, entity_id: UUID) -> ModelType | None:
        stmt = select(self.model).where(
            self.model.tenant_id == tenant_id,
            self.model.id == entity_id,
            self.model.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create(self, tenant_id: UUID, data: dict) -> ModelType:
        entity = self.model(tenant_id=tenant_id, **data)
        self.session.add(entity)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise RepositoryError(str(exc)) from exc
        await self.session.refresh(entity)
        return entity

    async def update(self, tenant_id: UUID, entity_id: UUID, data: dict) -> ModelType | None:
        stmt = (
            update(self.model)
            .where(
                self.model.tenant_id == tenant_id,
                self.model.id == entity_id,
                self.model.is_deleted.is_(False),
            )
            .values(**data)
            .returning(self.model)
        )
        result = await self.session.execute(stmt)
        entity = result.scalar_one_or_none()
        if entity is None:
            await self.session.rollback()
            return None
        await self.session.commit()
        return entity


class ClientRepository(BaseRepository[models.Client]):
    model = models.Client


class DealRepository(BaseRepository[models.Deal]):
    model = models.Deal

    async def list(self, tenant_id: UUID) -> Iterable[models.Deal]:
        stmt = (
            select(self.model)
            .where(
                self.model.tenant_id == tenant_id,
                self.model.is_deleted.is_(False),
            )
            .order_by(self.model.next_review_at.asc(), self.model.updated_at.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def mark_won(self, tenant_id: UUID, deal_id: UUID) -> models.Deal | None:
        stmt = (
            update(self.model)
            .where(
                self.model.tenant_id == tenant_id,
                self.model.id == deal_id,
                self.model.is_deleted.is_(False),
            )
            .values(status="won")
            .returning(self.model)
        )
        result = await self.session.execute(stmt)
        deal = result.scalar_one_or_none()
        if deal is None:
            await self.session.rollback()
            return None
        await self.session.commit()
        return deal


class PolicyRepository(BaseRepository[models.Policy]):
    model = models.Policy


class TaskRepository(BaseRepository[models.Task]):
    model = models.Task


class PaymentSyncLogRepository(BaseRepository[models.PaymentSyncLog]):
    model = models.PaymentSyncLog

    async def upsert_from_event(self, tenant_id: UUID, event: schemas.PaymentEvent) -> models.PaymentSyncLog:
        existing = await self.get_by_event(event.event_id)
        data = {
            "event_id": event.event_id,
            "payment_id": event.payment_id,
            "deal_id": event.deal_id,
            "policy_id": event.policy_id,
            "status": event.status,
            "amount": event.amount,
            "currency": event.currency,
            "occurred_at": event.occurred_at,
            "payload": event.payload,
        }
        if existing:
            for key, value in data.items():
                setattr(existing, key, value)
            await self.session.commit()
            await self.session.refresh(existing)
            return existing
        entity = self.model(tenant_id=tenant_id, owner_id=tenant_id, **data)  # system owner = tenant
        self.session.add(entity)
        await self.session.commit()
        await self.session.refresh(entity)
        return entity

    async def get_by_event(self, event_id: UUID) -> models.PaymentSyncLog | None:
        stmt = select(self.model).where(self.model.event_id == event_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()
