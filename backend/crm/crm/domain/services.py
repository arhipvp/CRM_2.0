from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Iterable, Protocol, Sequence
from uuid import UUID

from crm.domain import schemas
from crm.infrastructure import models, repositories


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

    async def list_deals(self, tenant_id: UUID) -> Iterable[schemas.DealRead]:
        deals = await self.repository.list(tenant_id)
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
    def __init__(self, repository: repositories.PolicyRepository):
        self.repository = repository

    async def list_policies(self, tenant_id: UUID) -> Iterable[schemas.PolicyRead]:
        policies = await self.repository.list(tenant_id)
        return [schemas.PolicyRead.model_validate(policy) for policy in policies]

    async def create_policy(self, tenant_id: UUID, payload: schemas.PolicyCreate) -> schemas.PolicyRead:
        entity = await self.repository.create(tenant_id, payload.model_dump())
        return schemas.PolicyRead.model_validate(entity)

    async def get_policy(self, tenant_id: UUID, policy_id: UUID) -> schemas.PolicyRead | None:
        entity = await self.repository.get(tenant_id, policy_id)
        if entity is None:
            return None
        return schemas.PolicyRead.model_validate(entity)

    async def update_policy(
        self, tenant_id: UUID, policy_id: UUID, payload: schemas.PolicyUpdate
    ) -> schemas.PolicyRead | None:
        entity = await self.repository.update(tenant_id, policy_id, payload.model_dump(exclude_unset=True))
        if entity is None:
            return None
        return schemas.PolicyRead.model_validate(entity)


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

        if "currency" in update_data and (payment.incomes_total or payment.expenses_total):
            raise repositories.RepositoryError("payment_has_transactions")

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
