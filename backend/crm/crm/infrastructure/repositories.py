from __future__ import annotations

from collections.abc import Iterable, Sequence
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Generic, Iterable, Sequence, TypeVar
from uuid import UUID

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from crm.infrastructure import models
from crm.domain.schemas import DealFilters, DealStage, map_deal_status_to_stage

DEAL_STAGE_ORDER: tuple[DealStage, ...] = (
    "qualification",
    "negotiation",
    "proposal",
    "closedWon",
    "closedLost",
)

STAGE_FILTER_MAP: dict[DealStage, tuple[str, ...]] = {
    "qualification": ("draft", "qualification"),
    "negotiation": ("in_progress", "negotiation"),
    "proposal": ("proposal",),
    "closedWon": ("won", "closed_won"),
    "closedLost": ("lost", "closed_lost"),
}


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

    async def list(
        self, tenant_id: UUID, filters: DealFilters | None = None
    ) -> Iterable[models.Deal]:
        stmt = select(self.model).where(
            self.model.tenant_id == tenant_id,
            self.model.is_deleted.is_(False),
        )

        if filters is not None:
            stmt = self._apply_filters(stmt, filters)

        stmt = stmt.order_by(self.model.next_review_at.asc(), self.model.updated_at.asc())
        result = await self.session.execute(stmt)
        return result.scalars().all()

    def _apply_filters(self, stmt, filters: DealFilters):
        if filters.stage is not None:
            statuses = STAGE_FILTER_MAP.get(filters.stage)
            if statuses:
                stmt = stmt.where(self.model.status.in_(statuses))

        owner_filters = []
        if filters.managers:
            owner_filters.append(self.model.owner_id.in_(filters.managers))
        if filters.include_unassigned:
            owner_filters.append(self.model.owner_id.is_(None))
        if owner_filters:
            stmt = stmt.where(or_(*owner_filters))

        if filters.period and filters.period != "all":
            today = date.today()
            delta_map = {"7d": 7, "30d": 30, "90d": 90}
            days = delta_map.get(filters.period)
            if days is not None:
                upper_bound = today + timedelta(days=days)
                stmt = stmt.where(self.model.next_review_at <= upper_bound)

        if filters.search:
            pattern = f"%{filters.search.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(self.model.title).like(pattern),
                    func.lower(self.model.description).like(pattern),
                )
            )

        return stmt

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

    async def stage_metrics(
        self, tenant_id: UUID, filters: DealFilters | None = None
    ) -> list[dict[str, object]]:
        stmt = select(self.model).where(
            self.model.tenant_id == tenant_id,
            self.model.is_deleted.is_(False),
        )

        if filters is not None:
            stmt = self._apply_filters(stmt, filters)

        result = await self.session.execute(stmt)
        deals = list(result.scalars().all())

        if not deals:
            return [
                {
                    "stage": stage,
                    "count": 0,
                    "total_value": Decimal("0"),
                    "conversion_rate": 0.0,
                    "avg_cycle_duration_days": None,
                }
                for stage in DEAL_STAGE_ORDER
            ]

        deal_ids = [deal.id for deal in deals]

        payments_stmt = (
            select(models.Payment.deal_id, func.coalesce(func.sum(models.Payment.planned_amount), 0))
            .where(
                models.Payment.tenant_id == tenant_id,
                models.Payment.deal_id.in_(deal_ids),
            )
            .group_by(models.Payment.deal_id)
        )
        payments_result = await self.session.execute(payments_stmt)
        payments_map = {row[0]: row[1] for row in payments_result.all()}

        stage_stats = {
            stage: {
                "count": 0,
                "total_value": Decimal("0"),
                "cycle_days_sum": 0.0,
                "cycle_count": 0,
            }
            for stage in DEAL_STAGE_ORDER
        }

        for deal in deals:
            stage = map_deal_status_to_stage(deal.status)
            stats = stage_stats[stage]
            stats["count"] += 1
            amount = payments_map.get(deal.id)
            if amount is None:
                amount_decimal = Decimal("0")
            elif isinstance(amount, Decimal):
                amount_decimal = amount
            else:
                amount_decimal = Decimal(str(amount))
            stats["total_value"] += amount_decimal

            created_at = deal.created_at
            updated_at = deal.updated_at
            if isinstance(created_at, datetime) and isinstance(updated_at, datetime):
                duration = (updated_at - created_at).total_seconds() / 86400
                if duration >= 0:
                    stats["cycle_days_sum"] += duration
                    stats["cycle_count"] += 1

        total_deals = len(deals)
        metrics: list[dict[str, object]] = []
        for stage in DEAL_STAGE_ORDER:
            stats = stage_stats[stage]
            count = stats["count"]
            conversion_rate = count / total_deals if total_deals else 0.0
            avg_cycle = (
                stats["cycle_days_sum"] / stats["cycle_count"]
                if stats["cycle_count"] > 0
                else None
            )
            metrics.append(
                {
                    "stage": stage,
                    "count": count,
                    "total_value": stats["total_value"],
                    "conversion_rate": float(conversion_rate),
                    "avg_cycle_duration_days": avg_cycle,
                }
            )

        return metrics


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

    async def assign_calculation(
        self,
        tenant_id: UUID,
        policy_id: UUID,
        calculation_id: UUID | None,
    ) -> models.Policy | None:
        stmt = (
            update(self.model)
            .where(
                self.model.tenant_id == tenant_id,
                self.model.id == policy_id,
                self.model.is_deleted.is_(False),
            )
            .values(calculation_id=calculation_id)
            .returning(self.model)
        )
        result = await self.session.execute(stmt)
        policy = result.scalar_one_or_none()
        if policy is None:
            await self.session.rollback()
            return None
        await self.session.commit()
        return policy


class PolicyDocumentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list(self, tenant_id: UUID, policy_id: UUID) -> list[models.PolicyDocument]:
        stmt = (
            select(models.PolicyDocument)
            .join(models.Policy, models.Policy.id == models.PolicyDocument.policy_id)
            .where(
                models.Policy.tenant_id == tenant_id,
                models.Policy.id == policy_id,
                models.Policy.is_deleted.is_(False),
            )
            .order_by(models.PolicyDocument.created_at.asc(), models.PolicyDocument.id.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def attach(
        self,
        tenant_id: UUID,
        policy_id: UUID,
        document_id: UUID,
    ) -> models.PolicyDocument | None:
        policy_exists = await self.session.scalar(
            select(models.Policy.id).where(
                models.Policy.tenant_id == tenant_id,
                models.Policy.id == policy_id,
                models.Policy.is_deleted.is_(False),
            )
        )
        if policy_exists is None:
            return None
        entity = models.PolicyDocument(
            tenant_id=tenant_id,
            policy_id=policy_id,
            document_id=document_id,
        )
        self.session.add(entity)
        try:
            await self.session.commit()
        except IntegrityError as exc:  # pragma: no cover - defensive guard
            await self.session.rollback()
            raise RepositoryError(self._map_integrity_error(exc)) from exc
        await self.session.refresh(entity)
        return entity

    async def detach(
        self,
        tenant_id: UUID,
        policy_id: UUID,
        document_id: UUID,
    ) -> bool:
        stmt = (
            delete(models.PolicyDocument)
            .where(
                models.PolicyDocument.tenant_id == tenant_id,
                models.PolicyDocument.policy_id == policy_id,
                models.PolicyDocument.document_id == document_id,
            )
            .returning(models.PolicyDocument.id)
        )
        result = await self.session.execute(stmt)
        deleted_id = result.scalar_one_or_none()
        if deleted_id is None:
            await self.session.rollback()
            return False
        await self.session.commit()
        return True

    @staticmethod
    def _map_integrity_error(exc: IntegrityError) -> str:
        message = str(exc.orig)
        if "ux_policy_documents_policy_document" in message:
            return "document_already_linked"
        if "fk_policy_documents_document_id" in message:
            return "document_not_found"
        return "policy_document_integrity_error"


class TaskRepository(BaseRepository[models.Task]):
    model = models.Task


class CalculationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        *,
        statuses: Sequence[str] | None = None,
        insurance_company: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[models.Calculation]:
        stmt = (
            select(models.Calculation)
            .where(
                models.Calculation.tenant_id == tenant_id,
                models.Calculation.deal_id == deal_id,
                models.Calculation.is_deleted.is_(False),
            )
            .order_by(
                models.Calculation.updated_at.desc(),
                models.Calculation.created_at.desc(),
            )
        )
        if statuses:
            stmt = stmt.where(models.Calculation.status.in_(list(statuses)))
        if insurance_company:
            stmt = stmt.where(models.Calculation.insurance_company.ilike(f"%{insurance_company}%"))
        if date_from:
            stmt = stmt.where(models.Calculation.calculation_date >= date_from)
        if date_to:
            stmt = stmt.where(models.Calculation.calculation_date <= date_to)
        stmt = stmt.options(selectinload(models.Calculation.policy))
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def get(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        calculation_id: UUID,
    ) -> models.Calculation | None:
        stmt = (
            select(models.Calculation)
            .where(
                models.Calculation.tenant_id == tenant_id,
                models.Calculation.deal_id == deal_id,
                models.Calculation.id == calculation_id,
                models.Calculation.is_deleted.is_(False),
            )
            .options(selectinload(models.Calculation.policy))
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        data: dict[str, object],
    ) -> models.Calculation:
        deal_exists = await self.session.scalar(
            select(models.Deal.id).where(
                models.Deal.id == deal_id,
                models.Deal.tenant_id == tenant_id,
                models.Deal.is_deleted.is_(False),
            )
        )
        if deal_exists is None:
            raise RepositoryError("deal_not_found")
        calculation = models.Calculation(tenant_id=tenant_id, deal_id=deal_id, **data)
        self.session.add(calculation)
        try:
            await self.session.commit()
        except IntegrityError as exc:  # pragma: no cover - defensive
            await self.session.rollback()
            raise RepositoryError(str(exc)) from exc
        await self.session.refresh(calculation)
        return calculation

    async def update(
        self,
        calculation: models.Calculation,
        data: dict[str, object],
    ) -> models.Calculation:
        for key, value in data.items():
            setattr(calculation, key, value)
        await self.session.commit()
        await self.session.refresh(calculation)
        return calculation

    async def delete(self, calculation: models.Calculation) -> None:
        calculation.is_deleted = True
        await self.session.commit()

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
        await self._ensure_policy(tenant_id, deal_id, policy_id)
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
        await self._ensure_policy(tenant_id, deal_id, policy_id)
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
        await self._ensure_policy(tenant_id, deal_id, policy_id)
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

    async def _ensure_policy(self, tenant_id: UUID, deal_id: UUID, policy_id: UUID) -> None:
        stmt = (
            select(models.Policy.id)
            .join(models.Deal, models.Policy.deal_id == models.Deal.id)
            .where(
                models.Policy.id == policy_id,
                models.Policy.tenant_id == tenant_id,
                models.Policy.is_deleted.is_(False),
                models.Policy.deal_id == deal_id,
                models.Deal.tenant_id == tenant_id,
                models.Deal.is_deleted.is_(False),
            )
        )
        policy_exists = await self.session.scalar(stmt)
        if policy_exists is None:
            raise RepositoryError("policy_not_found")


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
