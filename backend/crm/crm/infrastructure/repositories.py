from __future__ import annotations

from collections.abc import Iterable, Sequence
from decimal import Decimal
from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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


class DealJournalRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_entries(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[models.DealJournalEntry], int]:
        filters = (
            models.DealJournalEntry.deal_id == deal_id,
            models.Deal.tenant_id == tenant_id,
            models.Deal.is_deleted.is_(False),
        )
        stmt = (
            select(models.DealJournalEntry)
            .join(models.Deal, models.Deal.id == models.DealJournalEntry.deal_id)
            .where(*filters)
            .order_by(models.DealJournalEntry.created_at.asc(), models.DealJournalEntry.id.asc())
        )
        result = await self.session.execute(stmt.limit(limit).offset(offset))
        items = list(result.scalars().all())
        total_stmt = select(func.count()).select_from(models.DealJournalEntry).join(models.Deal).where(*filters)
        total = await self.session.scalar(total_stmt)
        return items, int(total or 0)

    async def create_entry(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        data: dict[str, object],
    ) -> models.DealJournalEntry | None:
        deal_exists = await self.session.scalar(
            select(models.Deal.id).where(
                models.Deal.id == deal_id,
                models.Deal.tenant_id == tenant_id,
                models.Deal.is_deleted.is_(False),
            )
        )
        if deal_exists is None:
            return None
        entry = models.DealJournalEntry(deal_id=deal_id, **data)
        self.session.add(entry)
        await self.session.commit()
        await self.session.refresh(entry)
        return entry


class PolicyRepository(BaseRepository[models.Policy]):
    model = models.Policy


class TaskRepository(BaseRepository[models.Task]):
    model = models.Task


class PaymentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_payments(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        *,
        statuses: Sequence[str] | None = None,
        limit: int = 50,
        offset: int = 0,
        include_incomes: bool = False,
        include_expenses: bool = False,
    ) -> tuple[list[models.Payment], int]:
        stmt = (
            select(models.Payment)
            .where(
                models.Payment.tenant_id == tenant_id,
                models.Payment.deal_id == deal_id,
                models.Payment.policy_id == policy_id,
            )
            .order_by(models.Payment.sequence.asc(), models.Payment.created_at.asc())
        )
        if statuses:
            stmt = stmt.where(models.Payment.status.in_(list(statuses)))
        if include_incomes:
            stmt = stmt.options(selectinload(models.Payment.incomes))
        if include_expenses:
            stmt = stmt.options(selectinload(models.Payment.expenses))
        total_stmt = (
            select(func.count())
            .select_from(models.Payment)
            .where(
                models.Payment.tenant_id == tenant_id,
                models.Payment.deal_id == deal_id,
                models.Payment.policy_id == policy_id,
            )
        )
        if statuses:
            total_stmt = total_stmt.where(models.Payment.status.in_(list(statuses)))
        result = await self.session.execute(stmt.limit(limit).offset(offset))
        items = list(result.scalars().unique().all())
        total = await self.session.scalar(total_stmt)
        return items, int(total or 0)

    async def get_payment(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        *,
        include_incomes: bool = False,
        include_expenses: bool = False,
    ) -> models.Payment | None:
        stmt = select(models.Payment).where(
            models.Payment.tenant_id == tenant_id,
            models.Payment.deal_id == deal_id,
            models.Payment.policy_id == policy_id,
            models.Payment.id == payment_id,
        )
        if include_incomes:
            stmt = stmt.options(selectinload(models.Payment.incomes))
        if include_expenses:
            stmt = stmt.options(selectinload(models.Payment.expenses))
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create_payment(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        data: dict[str, object],
    ) -> models.Payment:
        sequence = await self._next_sequence(tenant_id, policy_id)
        payment = models.Payment(
            tenant_id=tenant_id,
            deal_id=deal_id,
            policy_id=policy_id,
            sequence=sequence,
            **data,
        )
        self.session.add(payment)
        await self.session.commit()
        await self.session.refresh(payment)
        return payment

    async def update_payment(
        self,
        payment: models.Payment,
        data: dict[str, object],
    ) -> models.Payment:
        for key, value in data.items():
            setattr(payment, key, value)
        await self.session.commit()
        await self.session.refresh(payment)
        return payment

    async def delete_payment(self, payment: models.Payment) -> None:
        await self.session.delete(payment)
        await self.session.commit()

    async def recalculate_totals(self, payment: models.Payment) -> models.Payment:
        incomes_total = await self.session.scalar(
            select(func.coalesce(func.sum(models.PaymentIncome.amount), 0)).where(
                models.PaymentIncome.payment_id == payment.id
            )
        )
        expenses_total = await self.session.scalar(
            select(func.coalesce(func.sum(models.PaymentExpense.amount), 0)).where(
                models.PaymentExpense.payment_id == payment.id
            )
        )
        income_value = Decimal(incomes_total or 0)
        expense_value = Decimal(expenses_total or 0)
        payment.incomes_total = income_value
        payment.expenses_total = expense_value
        payment.net_total = income_value - expense_value
        await self.session.commit()
        await self.session.refresh(payment)
        return payment

    async def _next_sequence(self, tenant_id: UUID, policy_id: UUID) -> int:
        stmt = select(func.max(models.Payment.sequence)).where(
            models.Payment.tenant_id == tenant_id,
            models.Payment.policy_id == policy_id,
        )
        current = await self.session.scalar(stmt)
        if current is None:
            return 1
        return int(current) + 1


class PaymentIncomeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_income(
        self,
        payment: models.Payment,
        data: dict[str, object],
    ) -> models.PaymentIncome:
        entity = models.PaymentIncome(tenant_id=payment.tenant_id, payment_id=payment.id, **data)
        self.session.add(entity)
        await self.session.commit()
        await self.session.refresh(entity)
        return entity

    async def get_income(
        self,
        tenant_id: UUID,
        payment_id: UUID,
        income_id: UUID,
    ) -> models.PaymentIncome | None:
        stmt = select(models.PaymentIncome).where(
            models.PaymentIncome.tenant_id == tenant_id,
            models.PaymentIncome.payment_id == payment_id,
            models.PaymentIncome.id == income_id,
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def update_income(
        self,
        income: models.PaymentIncome,
        data: dict[str, object],
    ) -> models.PaymentIncome:
        for key, value in data.items():
            setattr(income, key, value)
        await self.session.commit()
        await self.session.refresh(income)
        return income

    async def delete_income(self, income: models.PaymentIncome) -> None:
        await self.session.delete(income)
        await self.session.commit()


class PaymentExpenseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_expense(
        self,
        payment: models.Payment,
        data: dict[str, object],
    ) -> models.PaymentExpense:
        entity = models.PaymentExpense(tenant_id=payment.tenant_id, payment_id=payment.id, **data)
        self.session.add(entity)
        await self.session.commit()
        await self.session.refresh(entity)
        return entity

    async def get_expense(
        self,
        tenant_id: UUID,
        payment_id: UUID,
        expense_id: UUID,
    ) -> models.PaymentExpense | None:
        stmt = select(models.PaymentExpense).where(
            models.PaymentExpense.tenant_id == tenant_id,
            models.PaymentExpense.payment_id == payment_id,
            models.PaymentExpense.id == expense_id,
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def update_expense(
        self,
        expense: models.PaymentExpense,
        data: dict[str, object],
    ) -> models.PaymentExpense:
        for key, value in data.items():
            setattr(expense, key, value)
        await self.session.commit()
        await self.session.refresh(expense)
        return expense

    async def delete_expense(self, expense: models.PaymentExpense) -> None:
        await self.session.delete(expense)
        await self.session.commit()


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
