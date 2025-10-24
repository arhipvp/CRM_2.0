from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Iterable, Protocol, Sequence
from uuid import UUID

try:  # pragma: no cover - optional dependency guard
    from asyncpg.pgproto.pgproto import Range as PgRange
except (ModuleNotFoundError, ImportError):  # pragma: no cover - lightweight fallback for typing
    class PgRange:  # type: ignore[override]
        def __init__(
            self,
            *,
            lower: date | None = None,
            upper: date | None = None,
            lower_inc: bool = False,
            upper_inc: bool = False,
        ) -> None:
            self.lower = lower
            self.upper = upper
            self.lower_inc = lower_inc
            self.upper_inc = upper_inc

from crm.domain import schemas
from crm.infrastructure import models, repositories
from crm.infrastructure.repositories import RepositoryError


class ClientService:
    def __init__(self, repository: repositories.ClientRepository):
        self.repository = repository

    async def list_clients(self, tenant_id: UUID) -> Iterable[schemas.ClientRead]:
        clients = await self.repository.list(tenant_id)
        return [schemas.ClientRead.model_validate(client) for client in clients]

    async def create_client(self, tenant_id: UUID, payload: schemas.ClientCreate) -> schemas.ClientRead:
        entity = await self.repository.create(tenant_id, payload.model_dump())
        return schemas.ClientRead.model_validate(entity)

    async def get_client(self, tenant_id: UUID, client_id: UUID) -> schemas.ClientRead | None:
        entity = await self.repository.get(tenant_id, client_id)
        if entity is None:
            return None
        return schemas.ClientRead.model_validate(entity)

    async def update_client(
        self, tenant_id: UUID, client_id: UUID, payload: schemas.ClientUpdate
    ) -> schemas.ClientRead | None:
        entity = await self.repository.update(tenant_id, client_id, payload.model_dump(exclude_unset=True))
        if entity is None:
            return None
        return schemas.ClientRead.model_validate(entity)


class DealService:
    def __init__(self, repository: repositories.DealRepository):
        self.repository = repository

    async def list_deals(
        self, tenant_id: UUID, filters: schemas.DealFilters | None = None
    ) -> Iterable[schemas.DealRead]:
        deals = await self.repository.list(tenant_id, filters)
        return [schemas.DealRead.model_validate(deal) for deal in deals]

    async def create_deal(self, tenant_id: UUID, payload: schemas.DealCreate) -> schemas.DealRead:
        entity = await self.repository.create(tenant_id, payload.model_dump())
        return schemas.DealRead.model_validate(entity)

    async def get_deal(self, tenant_id: UUID, deal_id: UUID) -> schemas.DealRead | None:
        entity = await self.repository.get(tenant_id, deal_id)
        if entity is None:
            return None
        return schemas.DealRead.model_validate(entity)

    async def update_deal(
        self, tenant_id: UUID, deal_id: UUID, payload: schemas.DealUpdate
    ) -> schemas.DealRead | None:
        entity = await self.repository.update(tenant_id, deal_id, payload.model_dump(exclude_unset=True))
        if entity is None:
            return None
        return schemas.DealRead.model_validate(entity)

    async def mark_deal_won(self, tenant_id: UUID, deal_id: UUID) -> schemas.DealRead | None:
        entity = await self.repository.mark_won(tenant_id, deal_id)
        if entity is None:
            return None
        return schemas.DealRead.model_validate(entity)

    async def update_stage(
        self, tenant_id: UUID, deal_id: UUID, stage: schemas.DealStage
    ) -> schemas.DealRead | None:
        status = schemas.map_stage_to_deal_status(stage)
        entity = await self.repository.update(tenant_id, deal_id, {"status": status})
        if entity is None:
            return None
        return schemas.DealRead.model_validate(entity)

    async def get_stage_metrics(
        self, tenant_id: UUID, filters: schemas.DealFilters | None = None
    ) -> Iterable[schemas.DealStageMetric]:
        metrics = await self.repository.stage_metrics(tenant_id, filters)
        return [schemas.DealStageMetric(**item) for item in metrics]


class DealJournalService:
    def __init__(
        self,
        repository: repositories.DealJournalRepository,
        events_publisher: EventsPublisherProtocol,
    ) -> None:
        self.repository = repository
        self.events = events_publisher

    async def list_entries(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> schemas.DealJournalEntryList:
        items, total = await self.repository.list_entries(
            tenant_id,
            deal_id,
            limit=limit,
            offset=offset,
        )
        entries = [schemas.DealJournalEntryRead.model_validate(item) for item in items]
        return schemas.DealJournalEntryList(items=entries, total=total)

    async def append_entry(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        payload: schemas.DealJournalEntryCreate,
    ) -> schemas.DealJournalEntryRead | None:
        entry = await self.repository.create_entry(
            tenant_id,
            deal_id,
            payload.model_dump(),
        )
        if entry is None:
            return None
        dto = schemas.DealJournalEntryRead.model_validate(entry)
        await self._publish_event(tenant_id, dto)
        return dto

    async def _publish_event(
        self,
        tenant_id: UUID,
        entry: schemas.DealJournalEntryRead,
    ) -> None:
        payload = {
            "tenant_id": str(tenant_id),
            "deal_id": str(entry.deal_id),
            "entry_id": str(entry.id),
            "author_id": str(entry.author_id),
            "body": entry.body,
            "created_at": entry.created_at.isoformat(),
        }
        await self.events.publish("deal.journal.appended", payload)


class PolicyService:
    def __init__(
        self,
        repository: repositories.PolicyRepository,
        policy_documents: repositories.PolicyDocumentRepository | None = None,
    ) -> None:
        self.repository = repository
        self.policy_documents = policy_documents

    async def list_policies(self, tenant_id: UUID) -> Iterable[schemas.PolicyRead]:
        policies = await self.repository.list(tenant_id)
        return [self._to_schema(policy) for policy in policies]

    async def create_policy(self, tenant_id: UUID, payload: schemas.PolicyCreate) -> schemas.PolicyRead:
        entity = await self.repository.create(tenant_id, payload.model_dump())
        return self._to_schema(entity)

    async def get_policy(self, tenant_id: UUID, policy_id: UUID) -> schemas.PolicyRead | None:
        entity = await self.repository.get(tenant_id, policy_id)
        if entity is None:
            return None
        return self._to_schema(entity)

    async def update_policy(
        self, tenant_id: UUID, policy_id: UUID, payload: schemas.PolicyUpdate
    ) -> schemas.PolicyRead | None:
        entity = await self.repository.update(tenant_id, policy_id, payload.model_dump(exclude_unset=True))
        if entity is None:
            return None
        return self._to_schema(entity)

    async def list_policy_documents(
        self, tenant_id: UUID, policy_id: UUID
    ) -> Iterable[schemas.PolicyDocumentRead] | None:
        if self.policy_documents is None:  # pragma: no cover - defensive
            raise RepositoryError("policy_documents_repository_not_configured")
        policy = await self.repository.get(tenant_id, policy_id)
        if policy is None:
            return None
        items = await self.policy_documents.list(tenant_id, policy_id)
        return [self._policy_document_to_schema(item) for item in items]

    async def attach_document(
        self, tenant_id: UUID, policy_id: UUID, document_id: UUID
    ) -> schemas.PolicyDocumentRead | None:
        if self.policy_documents is None:  # pragma: no cover - defensive
            raise RepositoryError("policy_documents_repository_not_configured")
        entity = await self.policy_documents.attach(tenant_id, policy_id, document_id)
        if entity is None:
            return None
        return self._policy_document_to_schema(entity)

    async def detach_document(
        self, tenant_id: UUID, policy_id: UUID, document_id: UUID
    ) -> bool | None:
        if self.policy_documents is None:  # pragma: no cover - defensive
            raise RepositoryError("policy_documents_repository_not_configured")
        policy = await self.repository.get(tenant_id, policy_id)
        if policy is None:
            return None
        return await self.policy_documents.detach(tenant_id, policy_id, document_id)

    @staticmethod
    def _to_schema(policy: models.Policy) -> schemas.PolicyRead:
        return schemas.PolicyRead.model_validate(policy)

    @staticmethod
    def _policy_document_to_schema(document: models.PolicyDocument) -> schemas.PolicyDocumentRead:
        return schemas.PolicyDocumentRead.model_validate(document)


class CalculationService:
    def __init__(
        self,
        repository: repositories.CalculationRepository,
        policy_repository: repositories.PolicyRepository,
        events_publisher: EventsPublisherProtocol,
        *,
        policy_service: PolicyService | None = None,
    ) -> None:
        self.repository = repository
        self.policies = policy_repository
        self.policy_service = policy_service or PolicyService(policy_repository)
        self.events = events_publisher

    async def list_calculations(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        *,
        statuses: Sequence[str] | None = None,
        insurance_company: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> Iterable[schemas.CalculationRead]:
        items = await self.repository.list(
            tenant_id,
            deal_id,
            statuses=statuses,
            insurance_company=insurance_company,
            date_from=date_from,
            date_to=date_to,
        )
        return [self._to_schema(calculation) for calculation in items]

    async def create_calculation(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        payload: schemas.CalculationCreate,
    ) -> schemas.CalculationRead:
        range_value = payload.validity_period
        data = payload.model_dump(exclude={"validity_period"})
        data["validity_period"] = self._date_range_to_pg(range_value)
        try:
            calculation = await self.repository.create(tenant_id, deal_id, data)
        except repositories.RepositoryError as exc:
            if str(exc) == "deal_not_found":
                raise
            raise
        calculation = await self.repository.get(tenant_id, deal_id, calculation.id) or calculation
        result = self._to_schema(calculation)
        await self._publish_event("deal.calculation.created", calculation)
        return result

    async def get_calculation(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        calculation_id: UUID,
    ) -> schemas.CalculationRead | None:
        calculation = await self.repository.get(tenant_id, deal_id, calculation_id)
        if calculation is None:
            return None
        return self._to_schema(calculation)

    async def update_calculation(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        calculation_id: UUID,
        payload: schemas.CalculationUpdate,
    ) -> schemas.CalculationRead | None:
        calculation = await self.repository.get(tenant_id, deal_id, calculation_id)
        if calculation is None:
            return None
        if calculation.status in {"confirmed", "archived"}:
            raise repositories.RepositoryError("calculation_update_forbidden")
        data = payload.model_dump(exclude_unset=True, exclude={"validity_period"})
        if "validity_period" in payload.model_fields_set:
            data["validity_period"] = self._date_range_to_pg(payload.validity_period)
        updated = await self.repository.update(calculation, data)
        result = self._to_schema(updated)
        await self._publish_event("deal.calculation.updated", updated)
        return result

    async def delete_calculation(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        calculation_id: UUID,
    ) -> bool:
        calculation = await self.repository.get(tenant_id, deal_id, calculation_id)
        if calculation is None:
            return False
        if calculation.policy is not None:
            await self.policies.assign_calculation(tenant_id, calculation.policy.id, None)
            calculation.policy = None
        await self.repository.delete(calculation)
        await self._publish_event("deal.calculation.deleted", calculation)
        return True

    async def change_status(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        calculation_id: UUID,
        payload: schemas.CalculationStatusChange,
    ) -> schemas.CalculationRead | None:
        calculation = await self.repository.get(tenant_id, deal_id, calculation_id)
        if calculation is None:
            return None

        current_status = calculation.status
        new_status = payload.status
        if not self._is_transition_allowed(current_status, new_status):
            raise repositories.RepositoryError("invalid_status_transition")

        if new_status == "ready":
            self._ensure_ready_prerequisites(calculation)

        linked_policy = None
        detach_policy = False
        if new_status == "confirmed":
            linked_policy = await self._resolve_policy(tenant_id, deal_id, calculation.id, payload.policy_id)
            if linked_policy is None and payload.policy_id is not None:
                raise repositories.RepositoryError("policy_not_found")
            if linked_policy is not None:
                if (
                    calculation.policy is not None
                    and calculation.policy.id != linked_policy.id
                ):
                    await self.policies.assign_calculation(
                        tenant_id, calculation.policy.id, None
                    )
                    calculation.policy = None
                await self.policies.assign_calculation(tenant_id, linked_policy.id, calculation.id)
        elif new_status == "archived" and calculation.policy is not None:
            detach_policy = True

        updated = await self.repository.update(calculation, {"status": new_status})

        if detach_policy and updated.policy is not None:
            await self.policies.assign_calculation(tenant_id, updated.policy.id, None)

        updated = await self.repository.get(tenant_id, deal_id, calculation_id) or updated

        await self._publish_event(f"deal.calculation.status.{new_status}", updated)
        return self._to_schema(updated)

    def _ensure_ready_prerequisites(self, calculation: models.Calculation) -> None:
        if not calculation.files:
            raise repositories.RepositoryError("files_required_for_ready")
        if not calculation.program_name:
            raise repositories.RepositoryError("program_required_for_ready")
        if calculation.premium_amount is None:
            raise repositories.RepositoryError("premium_required_for_ready")
        if calculation.validity_period is None:
            raise repositories.RepositoryError("validity_period_required_for_ready")
        if getattr(calculation.validity_period, "lower", None) is None or getattr(
            calculation.validity_period, "upper", None
        ) is None:
            raise repositories.RepositoryError("validity_period_required_for_ready")

    async def _resolve_policy(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        calculation_id: UUID,
        policy_id: UUID | None,
    ) -> schemas.PolicyRead | None:
        if policy_id is None:
            return None
        policy = await self.policy_service.get_policy(tenant_id, policy_id)
        if policy is None or policy.deal_id != deal_id:
            return None
        if policy.calculation_id and policy.calculation_id != calculation_id:
            raise repositories.RepositoryError("policy_already_linked")
        return policy

    @staticmethod
    def _is_transition_allowed(current: str, target: str) -> bool:
        allowed = {
            "draft": {"ready"},
            "ready": {"confirmed", "archived"},
            "confirmed": {"archived"},
            "archived": set(),
        }
        return target in allowed.get(current, set())

    @staticmethod
    def _date_range_to_pg(range_value: schemas.DateRange | None) -> PgRange | None:
        if range_value is None:
            return None
        start = range_value.start
        end = range_value.end
        if start is None and end is None:
            return None
        lower_inc = start is not None
        upper_inc = end is not None
        return PgRange(lower=start, upper=end, lower_inc=lower_inc, upper_inc=upper_inc)

    @staticmethod
    def _date_range_from_pg(range_value: PgRange | None) -> schemas.DateRange | None:
        if range_value is None:
            return None
        if getattr(range_value, "isempty", False):
            return None
        lower = getattr(range_value, "lower", None)
        upper = getattr(range_value, "upper", None)
        if lower is None and upper is None:
            return None
        if upper is not None and not getattr(range_value, "upper_inc", False):
            upper = upper - timedelta(days=1)
        return schemas.DateRange(start=lower, end=upper)

    def _to_schema(self, calculation: models.Calculation) -> schemas.CalculationRead:
        validity_period = self._date_range_from_pg(calculation.validity_period)
        linked_policy_id = calculation.policy.id if calculation.policy else None
        return schemas.CalculationRead(
            id=calculation.id,
            tenant_id=calculation.tenant_id,
            deal_id=calculation.deal_id,
            owner_id=calculation.owner_id,
            insurance_company=calculation.insurance_company,
            program_name=calculation.program_name,
            premium_amount=calculation.premium_amount,
            coverage_sum=calculation.coverage_sum,
            calculation_date=calculation.calculation_date,
            validity_period=validity_period,
            files=list(calculation.files or []),
            comments=calculation.comments,
            status=calculation.status,
            linked_policy_id=linked_policy_id,
            created_at=calculation.created_at,
            updated_at=calculation.updated_at,
        )

    async def _publish_event(self, routing_key: str, calculation: models.Calculation) -> None:
        payload = {
            "calculation_id": str(calculation.id),
            "deal_id": str(calculation.deal_id),
            "tenant_id": str(calculation.tenant_id),
            "status": calculation.status,
            "insurance_company": calculation.insurance_company,
            "calculation_date": calculation.calculation_date.isoformat(),
        }
        if calculation.program_name:
            payload["program_name"] = calculation.program_name
        if calculation.premium_amount is not None:
            payload["premium_amount"] = str(calculation.premium_amount)
        if calculation.policy is not None:
            payload["policy_id"] = str(calculation.policy.id)
        await self.events.publish(routing_key, payload)

class TaskService:
    def __init__(self, repository: repositories.TaskRepository):
        self.repository = repository

    async def list_tasks(self, tenant_id: UUID) -> Iterable[schemas.TaskRead]:
        tasks = await self.repository.list(tenant_id)
        return [schemas.TaskRead.model_validate(task) for task in tasks]

    async def create_task(self, tenant_id: UUID, payload: schemas.TaskCreate) -> schemas.TaskRead:
        entity = await self.repository.create(tenant_id, payload.model_dump())
        return schemas.TaskRead.model_validate(entity)

    async def get_task(self, tenant_id: UUID, task_id: UUID) -> schemas.TaskRead | None:
        entity = await self.repository.get(tenant_id, task_id)
        if entity is None:
            return None
        return schemas.TaskRead.model_validate(entity)

    async def update_task(
        self, tenant_id: UUID, task_id: UUID, payload: schemas.TaskUpdate
    ) -> schemas.TaskRead | None:
        entity = await self.repository.update(tenant_id, task_id, payload.model_dump(exclude_unset=True))
        if entity is None:
            return None
        return schemas.TaskRead.model_validate(entity)


class EventsPublisherProtocol(Protocol):
    async def publish(self, routing_key: str, payload: dict[str, Any]) -> None:  # pragma: no cover - interface definition
        ...


class PaymentService:
    def __init__(
        self,
        payment_repository: repositories.PaymentRepository,
        income_repository: repositories.PaymentIncomeRepository,
        expense_repository: repositories.PaymentExpenseRepository,
        events_publisher: EventsPublisherProtocol,
    ) -> None:
        self.payments = payment_repository
        self.incomes = income_repository
        self.expenses = expense_repository
        self.events = events_publisher

    async def list_payments(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        *,
        include: Sequence[str] | None = None,
        statuses: Sequence[str] | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> schemas.PaymentList:
        include = include or []
        include_incomes = "incomes" in include
        include_expenses = "expenses" in include
        items, total = await self.payments.list_payments(
            tenant_id,
            deal_id,
            policy_id,
            statuses=statuses,
            limit=limit,
            offset=offset,
            include_incomes=include_incomes,
            include_expenses=include_expenses,
        )
        payments = [
            self._to_schema(payment, include_incomes=include_incomes, include_expenses=include_expenses)
            for payment in items
        ]
        return schemas.PaymentList(items=payments, total=total)

    async def create_payment(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        payload: schemas.PaymentCreate,
    ) -> schemas.PaymentRead:
        data = payload.model_dump(exclude_unset=True)
        normalized_currency = self._normalize_currency(data["currency"])
        if not normalized_currency:
            raise repositories.RepositoryError("currency_mismatch")
        data["currency"] = normalized_currency
        payment = await self.payments.create_payment(tenant_id, deal_id, policy_id, data)
        payment = await self._finalize_payment(payment)
        await self._publish_payment_event("deal.payment.created", payment)
        return payment

    async def get_payment(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        *,
        include: Sequence[str] | None = None,
    ) -> schemas.PaymentRead | None:
        include = include or []
        payment = await self.payments.get_payment(
            tenant_id,
            deal_id,
            policy_id,
            payment_id,
            include_incomes="incomes" in include,
            include_expenses="expenses" in include,
        )
        if payment is None:
            return None
        return self._to_schema(
            payment,
            include_incomes="incomes" in include,
            include_expenses="expenses" in include,
        )

    async def update_payment(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        payload: schemas.PaymentUpdate,
    ) -> schemas.PaymentRead | None:
        payment = await self.payments.get_payment(tenant_id, deal_id, policy_id, payment_id)
        if payment is None:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        forced_status = None
        if "status" in update_data:
            status_value = str(update_data["status"])
            if status_value == "cancelled":
                forced_status = status_value
            update_data.pop("status", None)

        if "currency" in update_data and update_data["currency"] is not None:
            normalized_currency = self._normalize_currency(str(update_data["currency"]))
            if not normalized_currency:
                raise repositories.RepositoryError("currency_mismatch")
            update_data["currency"] = normalized_currency

        if "currency" in update_data and (payment.incomes_total or payment.expenses_total):
            raise repositories.RepositoryError("payment_has_transactions")

        if "actual_date" in update_data and update_data["actual_date"] is not None:
            actual_date = update_data["actual_date"]
            planned_date = update_data.get("planned_date", payment.planned_date)
            if planned_date is not None and actual_date < planned_date:
                raise repositories.RepositoryError("actual_date_before_planned_date")
            if actual_date > date.today():
                raise repositories.RepositoryError("actual_date_in_future")

        await self.payments.update_payment(payment, update_data)
        payment = await self._finalize_payment(payment, forced_status=forced_status)
        await self._publish_payment_event("deal.payment.updated", payment)
        return payment

    async def delete_payment(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
    ) -> bool:
        payment = await self.payments.get_payment(tenant_id, deal_id, policy_id, payment_id)
        if payment is None:
            return False
        incomes_total = Decimal(payment.incomes_total or 0)
        expenses_total = Decimal(payment.expenses_total or 0)
        if incomes_total > 0 or expenses_total > 0:
            raise repositories.RepositoryError("payment_has_transactions")
        await self.payments.delete_payment(payment)
        await self._publish_payment_event(
            "deal.payment.deleted",
            schemas.PaymentRead(
                id=payment.id,
                deal_id=payment.deal_id,
                policy_id=payment.policy_id,
                sequence=payment.sequence,
                status=payment.status,
                planned_date=payment.planned_date,
                planned_amount=Decimal(payment.planned_amount),
                currency=payment.currency,
                comment=payment.comment,
                actual_date=payment.actual_date,
                recorded_by_id=payment.recorded_by_id,
                created_by_id=payment.created_by_id,
                updated_by_id=payment.updated_by_id,
                incomes_total=Decimal(payment.incomes_total or 0),
                expenses_total=Decimal(payment.expenses_total or 0),
                net_total=Decimal(payment.net_total or 0),
                created_at=payment.created_at,
                updated_at=payment.updated_at,
                incomes=[],
                expenses=[],
            ),
            event_type="deleted",
        )
        return True

    async def create_income(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        payload: schemas.PaymentIncomeCreate,
    ) -> tuple[schemas.PaymentRead | None, schemas.PaymentIncomeRead | None]:
        payment = await self.payments.get_payment(tenant_id, deal_id, policy_id, payment_id)
        if payment is None:
            return None, None
        data = payload.model_dump(exclude_unset=True)
        normalized_currency = self._validate_transaction_input(
            payment,
            currency=str(data.get("currency")) if data.get("currency") is not None else None,
            posted_at=data.get("posted_at"),
        )
        if normalized_currency is not None:
            data["currency"] = normalized_currency
        income = await self.incomes.create_income(payment, data)
        payment = await self._finalize_payment(payment)
        income_schema = schemas.PaymentIncomeRead.model_validate(income)
        await self._publish_income_event("deal.payment.income.created", payment, income_schema)
        await self._publish_payment_event("deal.payment.updated", payment)
        return payment, income_schema

    async def update_income(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        income_id: UUID,
        payload: schemas.PaymentIncomeUpdate,
    ) -> tuple[schemas.PaymentRead | None, schemas.PaymentIncomeRead | None]:
        payment = await self.payments.get_payment(tenant_id, deal_id, policy_id, payment_id)
        if payment is None:
            return None, None
        income = await self.incomes.get_income(tenant_id, payment_id, income_id)
        if income is None:
            return None, None
        previous = schemas.PaymentIncomeRead.model_validate(income)
        update_data = payload.model_dump(exclude_unset=True)
        normalized_currency = self._validate_transaction_input(
            payment,
            currency=str(income.currency) if income.currency is not None else None,
            posted_at=update_data.get("posted_at"),
        )
        if normalized_currency is not None and str(income.currency) != normalized_currency:
            income.currency = normalized_currency
        income = await self.incomes.update_income(income, update_data)
        payment = await self._finalize_payment(payment)
        updated = schemas.PaymentIncomeRead.model_validate(income)
        await self._publish_income_event(
            "deal.payment.income.updated",
            payment,
            updated,
            previous=previous,
        )
        await self._publish_payment_event("deal.payment.updated", payment)
        return payment, updated

    async def delete_income(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        income_id: UUID,
        *,
        deleted_by_id: UUID | None = None,
    ) -> schemas.PaymentRead | None:
        payment = await self.payments.get_payment(tenant_id, deal_id, policy_id, payment_id)
        if payment is None:
            return None
        income = await self.incomes.get_income(tenant_id, payment_id, income_id)
        if income is None:
            return None
        await self.incomes.delete_income(income)
        payment = await self._finalize_payment(payment)
        await self._publish_income_event(
            "deal.payment.income.deleted",
            payment,
            None,
            deleted_id=income_id,
            deleted_by_id=deleted_by_id,
        )
        await self._publish_payment_event("deal.payment.updated", payment)
        return payment

    async def create_expense(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        payload: schemas.PaymentExpenseCreate,
    ) -> tuple[schemas.PaymentRead | None, schemas.PaymentExpenseRead | None]:
        payment = await self.payments.get_payment(tenant_id, deal_id, policy_id, payment_id)
        if payment is None:
            return None, None
        data = payload.model_dump(exclude_unset=True)
        normalized_currency = self._validate_transaction_input(
            payment,
            currency=str(data.get("currency")) if data.get("currency") is not None else None,
            posted_at=data.get("posted_at"),
        )
        if normalized_currency is not None:
            data["currency"] = normalized_currency
        expense = await self.expenses.create_expense(payment, data)
        payment = await self._finalize_payment(payment)
        expense_schema = schemas.PaymentExpenseRead.model_validate(expense)
        await self._publish_expense_event("deal.payment.expense.created", payment, expense_schema)
        await self._publish_payment_event("deal.payment.updated", payment)
        return payment, expense_schema

    async def update_expense(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        expense_id: UUID,
        payload: schemas.PaymentExpenseUpdate,
    ) -> tuple[schemas.PaymentRead | None, schemas.PaymentExpenseRead | None]:
        payment = await self.payments.get_payment(tenant_id, deal_id, policy_id, payment_id)
        if payment is None:
            return None, None
        expense = await self.expenses.get_expense(tenant_id, payment_id, expense_id)
        if expense is None:
            return None, None
        previous = schemas.PaymentExpenseRead.model_validate(expense)
        update_data = payload.model_dump(exclude_unset=True)
        normalized_currency = self._validate_transaction_input(
            payment,
            currency=str(expense.currency) if expense.currency is not None else None,
            posted_at=update_data.get("posted_at"),
        )
        if normalized_currency is not None and str(expense.currency) != normalized_currency:
            expense.currency = normalized_currency
        expense = await self.expenses.update_expense(expense, update_data)
        payment = await self._finalize_payment(payment)
        updated = schemas.PaymentExpenseRead.model_validate(expense)
        await self._publish_expense_event(
            "deal.payment.expense.updated",
            payment,
            updated,
            previous=previous,
        )
        await self._publish_payment_event("deal.payment.updated", payment)
        return payment, updated

    async def delete_expense(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        expense_id: UUID,
        *,
        deleted_by_id: UUID | None = None,
    ) -> schemas.PaymentRead | None:
        payment = await self.payments.get_payment(tenant_id, deal_id, policy_id, payment_id)
        if payment is None:
            return None
        expense = await self.expenses.get_expense(tenant_id, payment_id, expense_id)
        if expense is None:
            return None
        await self.expenses.delete_expense(expense)
        payment = await self._finalize_payment(payment)
        await self._publish_expense_event(
            "deal.payment.expense.deleted",
            payment,
            None,
            deleted_id=expense_id,
            deleted_by_id=deleted_by_id,
        )
        await self._publish_payment_event("deal.payment.updated", payment)
        return payment

    def _validate_transaction_input(
        self,
        payment: models.Payment,
        *,
        currency: str | None,
        posted_at: date | None,
    ) -> str | None:
        normalized_payment_currency = self._normalize_currency(payment.currency)
        if not normalized_payment_currency:
            raise repositories.RepositoryError("currency_mismatch")

        normalized_input: str | None = None
        if currency is not None:
            normalized = self._normalize_currency(currency)
            if not normalized:
                raise repositories.RepositoryError("currency_mismatch")
            if normalized != normalized_payment_currency:
                raise repositories.RepositoryError("currency_mismatch")
            normalized_input = normalized_payment_currency
        if posted_at is not None:
            # Используем локальную дату сервера, чтобы не отклонять операции,
            # введённые в тот же календарный день в регионах, опережающих UTC.
            today = datetime.now(timezone.utc).astimezone().date()
            if posted_at > today:
                raise repositories.RepositoryError("posted_at_in_future")
        return normalized_input

    @staticmethod
    def _normalize_currency(value: str) -> str:
        return value.strip().upper()

    async def _finalize_payment(
        self,
        payment: models.Payment,
        *,
        forced_status: str | None = None,
    ) -> schemas.PaymentRead:
        payment = await self.payments.recalculate_totals(payment)
        next_status = self._derive_status(payment, forced_status)
        if payment.status != next_status:
            payment = await self.payments.update_payment(payment, {"status": next_status})
        reloaded = await self.payments.get_payment(
            payment.tenant_id,
            payment.deal_id,
            payment.policy_id,
            payment.id,
            include_incomes=True,
            include_expenses=True,
        )
        assert reloaded is not None
        return self._to_schema(reloaded, include_incomes=True, include_expenses=True)

    def _derive_status(self, payment: models.Payment, forced_status: str | None = None) -> str:
        if forced_status == "cancelled":
            return "cancelled"
        if payment.status == "cancelled" and forced_status is None:
            return "cancelled"
        planned_amount = Decimal(payment.planned_amount)
        incomes_total = Decimal(payment.incomes_total or 0)
        if incomes_total <= 0:
            return "scheduled"
        if planned_amount <= 0:
            return "paid"
        if incomes_total >= planned_amount:
            return "paid"
        return "partially_paid"

    def _to_schema(
        self,
        payment: models.Payment,
        *,
        include_incomes: bool,
        include_expenses: bool,
    ) -> schemas.PaymentRead:
        incomes = payment.incomes if include_incomes else []
        expenses = payment.expenses if include_expenses else []
        return schemas.PaymentRead(
            id=payment.id,
            deal_id=payment.deal_id,
            policy_id=payment.policy_id,
            sequence=payment.sequence,
            status=payment.status,
            planned_date=payment.planned_date,
            planned_amount=Decimal(payment.planned_amount),
            currency=payment.currency,
            comment=payment.comment,
            actual_date=payment.actual_date,
            recorded_by_id=payment.recorded_by_id,
            created_by_id=payment.created_by_id,
            updated_by_id=payment.updated_by_id,
            incomes_total=Decimal(payment.incomes_total or 0),
            expenses_total=Decimal(payment.expenses_total or 0),
            net_total=Decimal(payment.net_total or 0),
            created_at=payment.created_at,
            updated_at=payment.updated_at,
            incomes=[schemas.PaymentIncomeRead.model_validate(item) for item in incomes],
            expenses=[schemas.PaymentExpenseRead.model_validate(item) for item in expenses],
        )

    async def _publish_payment_event(
        self,
        routing_key: str,
        payment: schemas.PaymentRead,
        event_type: str | None = None,
    ) -> None:
        payload: dict[str, Any]
        if event_type == "deleted":
            payload = {
                "deal_id": str(payment.deal_id),
                "policy_id": str(payment.policy_id),
                "payment_id": str(payment.id),
                "deleted_at": datetime.now(timezone.utc).isoformat(),
            }
        else:
            payload = {
                "deal_id": str(payment.deal_id),
                "policy_id": str(payment.policy_id),
                "payment": payment.model_dump(mode="json"),
            }
        await self.events.publish(routing_key, payload)

    async def _publish_income_event(
        self,
        routing_key: str,
        payment: schemas.PaymentRead,
        income: schemas.PaymentIncomeRead | None,
        *,
        previous: schemas.PaymentIncomeRead | None = None,
        deleted_id: UUID | None = None,
        deleted_by_id: UUID | None = None,
    ) -> None:
        payload: dict[str, Any] = {
            "deal_id": str(payment.deal_id),
            "policy_id": str(payment.policy_id),
            "payment_id": str(payment.id),
        }
        if income is not None:
            payload["income"] = income.model_dump(mode="json")
        if previous is not None:
            payload["previous"] = previous.model_dump(mode="json")
        if deleted_id is not None:
            payload["income"] = {
                "income_id": str(deleted_id),
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by_id": str(deleted_by_id) if deleted_by_id else None,
            }
        await self.events.publish(routing_key, payload)

    async def _publish_expense_event(
        self,
        routing_key: str,
        payment: schemas.PaymentRead,
        expense: schemas.PaymentExpenseRead | None,
        *,
        previous: schemas.PaymentExpenseRead | None = None,
        deleted_id: UUID | None = None,
        deleted_by_id: UUID | None = None,
    ) -> None:
        payload: dict[str, Any] = {
            "deal_id": str(payment.deal_id),
            "policy_id": str(payment.policy_id),
            "payment_id": str(payment.id),
        }
        if expense is not None:
            payload["expense"] = expense.model_dump(mode="json")
        if previous is not None:
            payload["previous"] = previous.model_dump(mode="json")
        if deleted_id is not None:
            payload["expense"] = {
                "expense_id": str(deleted_id),
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by_id": str(deleted_by_id) if deleted_by_id else None,
            }
        await self.events.publish(routing_key, payload)


class PermissionsQueueProtocol(Protocol):
    async def enqueue(self, job_id: str, payload: dict[str, Any]) -> str:  # pragma: no cover - protocol definition
        ...


class PermissionSyncError(RuntimeError):
    pass


class PermissionSyncService:
    def __init__(
        self,
        repository: repositories.PermissionSyncJobRepository,
        queue: PermissionsQueueProtocol,
        queue_name: str,
    ) -> None:
        self.repository = repository
        self.queue = queue
        self.queue_name = queue_name

    async def sync_permissions(
        self, tenant_id: UUID, payload: schemas.SyncPermissionsDto
    ) -> schemas.SyncPermissionsResponse:
        job = await self.repository.create_job(tenant_id, payload, self.queue_name)
        job_payload = {
            "tenantId": str(tenant_id),
            "ownerType": payload.owner_type,
            "ownerId": str(payload.owner_id),
            "users": [user.model_dump(mode="json") for user in payload.users],
        }
        try:
            await self.queue.enqueue(str(job.id), job_payload)
        except Exception as exc:  # noqa: BLE001
            await self.repository.mark_failed(job.id, str(exc))
            raise PermissionSyncError("failed_to_enqueue_permissions_sync_job") from exc
        return schemas.SyncPermissionsResponse(job_id=job.id, status=job.status)
