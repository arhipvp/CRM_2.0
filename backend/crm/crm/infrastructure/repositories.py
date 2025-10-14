from __future__ import annotations

from collections.abc import Iterable
from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy import func, select, update
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

    async def delete(self, tenant_id: UUID, entity_id: UUID) -> bool:
        stmt = (
            update(self.model)
            .where(
                self.model.tenant_id == tenant_id,
                self.model.id == entity_id,
                self.model.is_deleted.is_(False),
            )
            .values(is_deleted=True)
        )
        result = await self.session.execute(stmt)
        if result.rowcount == 0:
            await self.session.rollback()
            return False
        await self.session.commit()
        return True


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


class PaymentRepository(BaseRepository[models.Payment]):
    model = models.Payment

    async def create(self, tenant_id: UUID, data: dict) -> models.Payment:
        if "sequence" not in data or data["sequence"] is None:
            data["sequence"] = await self._next_sequence(tenant_id, data["policy_id"])
        return await super().create(tenant_id, data)

    async def list_for_policy(
        self, tenant_id: UUID, deal_id: UUID, policy_id: UUID
    ) -> Iterable[models.Payment]:
        stmt = (
            select(self.model)
            .where(
                self.model.tenant_id == tenant_id,
                self.model.deal_id == deal_id,
                self.model.policy_id == policy_id,
                self.model.is_deleted.is_(False),
            )
            .order_by(self.model.sequence.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_for_deal(
        self, tenant_id: UUID, deal_id: UUID, payment_id: UUID
    ) -> models.Payment | None:
        stmt = select(self.model).where(
            self.model.tenant_id == tenant_id,
            self.model.deal_id == deal_id,
            self.model.id == payment_id,
            self.model.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def recalculate_totals(self, tenant_id: UUID, payment_id: UUID) -> models.Payment | None:
        incomes_stmt = (
            select(func.coalesce(func.sum(models.PaymentIncome.amount), 0))
            .where(
                models.PaymentIncome.tenant_id == tenant_id,
                models.PaymentIncome.payment_id == payment_id,
                models.PaymentIncome.is_deleted.is_(False),
            )
        )
        expenses_stmt = (
            select(func.coalesce(func.sum(models.PaymentExpense.amount), 0))
            .where(
                models.PaymentExpense.tenant_id == tenant_id,
                models.PaymentExpense.payment_id == payment_id,
                models.PaymentExpense.is_deleted.is_(False),
            )
        )
        incomes_total = (await self.session.execute(incomes_stmt)).scalar_one()
        expenses_total = (await self.session.execute(expenses_stmt)).scalar_one()
        net_total = incomes_total - expenses_total

        stmt = (
            update(self.model)
            .where(
                self.model.tenant_id == tenant_id,
                self.model.id == payment_id,
                self.model.is_deleted.is_(False),
            )
            .values(
                incomes_total=incomes_total,
                expenses_total=expenses_total,
                net_total=net_total,
            )
            .returning(self.model)
        )
        result = await self.session.execute(stmt)
        entity = result.scalar_one_or_none()
        if entity is None:
            await self.session.rollback()
            return None
        await self.session.commit()
        return entity

    async def _next_sequence(self, tenant_id: UUID, policy_id: UUID) -> int:
        stmt = (
            select(func.coalesce(func.max(self.model.sequence), 0))
            .where(
                self.model.tenant_id == tenant_id,
                self.model.policy_id == policy_id,
            )
        )
        result = await self.session.execute(stmt)
        current = result.scalar_one()
        return int(current) + 1


class PaymentIncomeRepository(BaseRepository[models.PaymentIncome]):
    model = models.PaymentIncome

    async def list_for_payment(self, tenant_id: UUID, payment_id: UUID) -> Iterable[models.PaymentIncome]:
        stmt = (
            select(self.model)
            .where(
                self.model.tenant_id == tenant_id,
                self.model.payment_id == payment_id,
                self.model.is_deleted.is_(False),
            )
            .order_by(self.model.posted_at.asc(), self.model.created_at.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_for_payment(
        self, tenant_id: UUID, payment_id: UUID, entity_id: UUID
    ) -> models.PaymentIncome | None:
        stmt = select(self.model).where(
            self.model.tenant_id == tenant_id,
            self.model.payment_id == payment_id,
            self.model.id == entity_id,
            self.model.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


class PaymentExpenseRepository(BaseRepository[models.PaymentExpense]):
    model = models.PaymentExpense

    async def list_for_payment(self, tenant_id: UUID, payment_id: UUID) -> Iterable[models.PaymentExpense]:
        stmt = (
            select(self.model)
            .where(
                self.model.tenant_id == tenant_id,
                self.model.payment_id == payment_id,
                self.model.is_deleted.is_(False),
            )
            .order_by(self.model.posted_at.asc(), self.model.created_at.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_for_payment(
        self, tenant_id: UUID, payment_id: UUID, entity_id: UUID
    ) -> models.PaymentExpense | None:
        stmt = select(self.model).where(
            self.model.tenant_id == tenant_id,
            self.model.payment_id == payment_id,
            self.model.id == entity_id,
            self.model.is_deleted.is_(False),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


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


class PermissionSyncJobRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_job(
        self,
        tenant_id: UUID,
        payload: schemas.SyncPermissionsDto,
        queue_name: str,
    ) -> models.PermissionSyncJob:
        entity = models.PermissionSyncJob(
            tenant_id=tenant_id,
            owner_type=payload.owner_type,
            owner_id=payload.owner_id,
            queue_name=queue_name,
            users=[user.model_dump(mode="json") for user in payload.users],
        )
        self.session.add(entity)
        await self.session.commit()
        await self.session.refresh(entity)
        return entity

    async def mark_failed(self, job_id: UUID, error: str) -> None:
        stmt = (
            update(models.PermissionSyncJob)
            .where(models.PermissionSyncJob.id == job_id)
            .values(status="failed", last_error=error)
        )
        await self.session.execute(stmt)
        await self.session.commit()
