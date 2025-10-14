from __future__ import annotations

from typing import Any, Iterable, Protocol
from uuid import UUID

from crm.domain import schemas
from crm.infrastructure import models as db_models, repositories


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


class DomainEventsPublisher(Protocol):
    async def publish(self, routing_key: str, payload: dict[str, Any]) -> None:  # pragma: no cover - protocol definition
        ...


def _serialize_payment(payment: schemas.PaymentRead) -> dict[str, Any]:
    return payment.model_dump(mode="json", exclude_none=True)


def _serialize_income(income: schemas.PaymentIncomeRead) -> dict[str, Any]:
    return income.model_dump(mode="json", exclude_none=True)


def _serialize_expense(expense: schemas.PaymentExpenseRead) -> dict[str, Any]:
    return expense.model_dump(mode="json", exclude_none=True)


class PaymentService:
    def __init__(
        self,
        repository: repositories.PaymentRepository,
        income_repository: repositories.PaymentIncomeRepository,
        expense_repository: repositories.PaymentExpenseRepository,
        events: DomainEventsPublisher,
    ) -> None:
        self.repository = repository
        self.income_repository = income_repository
        self.expense_repository = expense_repository
        self.events = events

    async def list_payments(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        include_incomes: bool = False,
        include_expenses: bool = False,
    ) -> Iterable[schemas.PaymentRead]:
        payments = await self.repository.list_for_policy(tenant_id, deal_id, policy_id)
        result: list[schemas.PaymentRead] = []
        for payment in payments:
            result.append(
                await self._load_payment(tenant_id, payment, include_incomes, include_expenses)
            )
        return result

    async def create_payment(
        self, tenant_id: UUID, payload: schemas.PaymentCreate
    ) -> schemas.PaymentRead:
        entity = await self.repository.create(tenant_id, payload.model_dump())
        payment = await self.repository.get(tenant_id, entity.id)
        assert payment is not None  # repository just created it
        schema = await self._load_payment(tenant_id, payment, include_incomes=True, include_expenses=True)
        await self.events.publish(
            "deal.payment.created",
            {
                "deal_id": str(schema.deal_id),
                "policy_id": str(schema.policy_id),
                "payment": _serialize_payment(schema),
            },
        )
        await self.events.publish(
            "deal.payment.updated",
            {
                "deal_id": str(schema.deal_id),
                "policy_id": str(schema.policy_id),
                "payment": _serialize_payment(schema),
            },
        )
        return schema

    async def get_payment(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        payment_id: UUID,
        include_incomes: bool = False,
        include_expenses: bool = False,
    ) -> schemas.PaymentRead | None:
        entity = await self.repository.get_for_deal(tenant_id, deal_id, payment_id)
        if entity is None:
            return None
        return await self._load_payment(tenant_id, entity, include_incomes, include_expenses)

    async def update_payment(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        payment_id: UUID,
        payload: schemas.PaymentUpdate,
    ) -> schemas.PaymentRead | None:
        existing = await self.repository.get_for_deal(tenant_id, deal_id, payment_id)
        if existing is None:
            return None
        update_data = payload.model_dump(exclude_unset=True)
        entity = await self.repository.update(tenant_id, payment_id, update_data)
        if entity is None:
            return None
        payment = await self.repository.get(tenant_id, payment_id)
        assert payment is not None
        schema = await self._load_payment(tenant_id, payment, include_incomes=True, include_expenses=True)
        await self.events.publish(
            "deal.payment.updated",
            {
                "deal_id": str(schema.deal_id),
                "policy_id": str(schema.policy_id),
                "payment": _serialize_payment(schema),
            },
        )
        return schema

    async def delete_payment(self, tenant_id: UUID, deal_id: UUID, payment_id: UUID) -> bool:
        payment = await self.repository.get_for_deal(tenant_id, deal_id, payment_id)
        if payment is None:
            return False
        incomes = await self.income_repository.list_for_payment(tenant_id, payment_id)
        expenses = await self.expense_repository.list_for_payment(tenant_id, payment_id)
        for income in incomes:
            await self.income_repository.delete(tenant_id, income.id)
        for expense in expenses:
            await self.expense_repository.delete(tenant_id, expense.id)
        deleted = await self.repository.delete(tenant_id, payment_id)
        if not deleted:
            return False
        schema = schemas.PaymentRead.model_validate(payment)
        await self.events.publish(
            "deal.payment.deleted",
            {
                "deal_id": str(schema.deal_id),
                "policy_id": str(schema.policy_id),
                "payment_id": str(schema.id),
            },
        )
        return True

    async def _load_payment(
        self,
        tenant_id: UUID,
        entity: db_models.Payment,
        include_incomes: bool,
        include_expenses: bool,
    ) -> schemas.PaymentRead:
        schema = schemas.PaymentRead.model_validate(entity)
        if include_incomes:
            income_entities = await self.income_repository.list_for_payment(tenant_id, entity.id)
            schema.incomes = [schemas.PaymentIncomeRead.model_validate(item) for item in income_entities]
        if include_expenses:
            expense_entities = await self.expense_repository.list_for_payment(tenant_id, entity.id)
            schema.expenses = [schemas.PaymentExpenseRead.model_validate(item) for item in expense_entities]
        return schema


class PaymentIncomeService:
    def __init__(
        self,
        repository: repositories.PaymentIncomeRepository,
        payment_repository: repositories.PaymentRepository,
        expense_repository: repositories.PaymentExpenseRepository,
        events: DomainEventsPublisher,
    ) -> None:
        self.repository = repository
        self.payment_repository = payment_repository
        self.expense_repository = expense_repository
        self.events = events

    async def create_income(
        self, tenant_id: UUID, payment_id: UUID, payload: schemas.PaymentIncomeCreate
    ) -> schemas.PaymentIncomeRead | None:
        payment = await self.payment_repository.get(tenant_id, payment_id)
        if payment is None:
            return None
        data = payload.model_dump()
        data["payment_id"] = payment_id
        entity = await self.repository.create(tenant_id, data)
        updated_payment = await self.payment_repository.recalculate_totals(tenant_id, payment_id)
        assert updated_payment is not None
        payment_schema = await self._load_payment(tenant_id, payment_id)
        income = schemas.PaymentIncomeRead.model_validate(entity)
        await self.events.publish(
            "deal.payment.income.created",
            {
                "deal_id": str(payment_schema.deal_id),
                "policy_id": str(payment_schema.policy_id),
                "payment_id": str(payment_schema.id),
                "income": _serialize_income(income),
            },
        )
        await self.events.publish(
            "deal.payment.updated",
            {
                "deal_id": str(payment_schema.deal_id),
                "policy_id": str(payment_schema.policy_id),
                "payment": _serialize_payment(payment_schema),
            },
        )
        return income

    async def list_incomes(self, tenant_id: UUID, payment_id: UUID) -> Iterable[schemas.PaymentIncomeRead]:
        items = await self.repository.list_for_payment(tenant_id, payment_id)
        return [schemas.PaymentIncomeRead.model_validate(item) for item in items]

    async def get_income(
        self, tenant_id: UUID, payment_id: UUID, income_id: UUID
    ) -> schemas.PaymentIncomeRead | None:
        entity = await self.repository.get_for_payment(tenant_id, payment_id, income_id)
        if entity is None:
            return None
        return schemas.PaymentIncomeRead.model_validate(entity)

    async def update_income(
        self, tenant_id: UUID, payment_id: UUID, income_id: UUID, payload: schemas.PaymentIncomeUpdate
    ) -> schemas.PaymentIncomeRead | None:
        existing = await self.repository.get_for_payment(tenant_id, payment_id, income_id)
        if existing is None:
            return None
        data = payload.model_dump(exclude_unset=True)
        entity = await self.repository.update(tenant_id, income_id, data)
        if entity is None:
            return None
        updated_payment = await self.payment_repository.recalculate_totals(tenant_id, payment_id)
        assert updated_payment is not None
        payment_schema = await self._load_payment(tenant_id, payment_id)
        income = schemas.PaymentIncomeRead.model_validate(entity)
        await self.events.publish(
            "deal.payment.income.updated",
            {
                "deal_id": str(payment_schema.deal_id),
                "policy_id": str(payment_schema.policy_id),
                "payment_id": str(payment_schema.id),
                "income": _serialize_income(income),
            },
        )
        await self.events.publish(
            "deal.payment.updated",
            {
                "deal_id": str(payment_schema.deal_id),
                "policy_id": str(payment_schema.policy_id),
                "payment": _serialize_payment(payment_schema),
            },
        )
        return income

    async def delete_income(self, tenant_id: UUID, payment_id: UUID, income_id: UUID) -> bool:
        existing = await self.repository.get_for_payment(tenant_id, payment_id, income_id)
        if existing is None:
            return False
        deleted = await self.repository.delete(tenant_id, income_id)
        if not deleted:
            return False
        updated_payment = await self.payment_repository.recalculate_totals(tenant_id, payment_id)
        if updated_payment is None:
            return True
        payment_schema = await self._load_payment(tenant_id, payment_id)
        await self.events.publish(
            "deal.payment.income.deleted",
            {
                "deal_id": str(payment_schema.deal_id),
                "policy_id": str(payment_schema.policy_id),
                "payment_id": str(payment_schema.id),
                "income": {"income_id": str(income_id)},
            },
        )
        await self.events.publish(
            "deal.payment.updated",
            {
                "deal_id": str(payment_schema.deal_id),
                "policy_id": str(payment_schema.policy_id),
                "payment": _serialize_payment(payment_schema),
            },
        )
        return True

    async def _load_payment(self, tenant_id: UUID, payment_id: UUID) -> schemas.PaymentRead:
        payment_entity = await self.payment_repository.get(tenant_id, payment_id)
        assert payment_entity is not None
        schema = schemas.PaymentRead.model_validate(payment_entity)
        incomes = await self.repository.list_for_payment(tenant_id, payment_id)
        expenses = await self.expense_repository.list_for_payment(tenant_id, payment_id)
        schema.incomes = [schemas.PaymentIncomeRead.model_validate(item) for item in incomes]
        schema.expenses = [schemas.PaymentExpenseRead.model_validate(item) for item in expenses]
        return schema


class PaymentExpenseService:
    def __init__(
        self,
        repository: repositories.PaymentExpenseRepository,
        payment_repository: repositories.PaymentRepository,
        income_repository: repositories.PaymentIncomeRepository,
        events: DomainEventsPublisher,
    ) -> None:
        self.repository = repository
        self.payment_repository = payment_repository
        self.income_repository = income_repository
        self.events = events

    async def create_expense(
        self, tenant_id: UUID, payment_id: UUID, payload: schemas.PaymentExpenseCreate
    ) -> schemas.PaymentExpenseRead | None:
        payment = await self.payment_repository.get(tenant_id, payment_id)
        if payment is None:
            return None
        data = payload.model_dump()
        data["payment_id"] = payment_id
        entity = await self.repository.create(tenant_id, data)
        updated_payment = await self.payment_repository.recalculate_totals(tenant_id, payment_id)
        assert updated_payment is not None
        payment_schema = await self._load_payment(tenant_id, payment_id)
        expense = schemas.PaymentExpenseRead.model_validate(entity)
        await self.events.publish(
            "deal.payment.expense.created",
            {
                "deal_id": str(payment_schema.deal_id),
                "policy_id": str(payment_schema.policy_id),
                "payment_id": str(payment_schema.id),
                "expense": _serialize_expense(expense),
            },
        )
        await self.events.publish(
            "deal.payment.updated",
            {
                "deal_id": str(payment_schema.deal_id),
                "policy_id": str(payment_schema.policy_id),
                "payment": _serialize_payment(payment_schema),
            },
        )
        return expense

    async def list_expenses(self, tenant_id: UUID, payment_id: UUID) -> Iterable[schemas.PaymentExpenseRead]:
        items = await self.repository.list_for_payment(tenant_id, payment_id)
        return [schemas.PaymentExpenseRead.model_validate(item) for item in items]

    async def get_expense(
        self, tenant_id: UUID, payment_id: UUID, expense_id: UUID
    ) -> schemas.PaymentExpenseRead | None:
        entity = await self.repository.get_for_payment(tenant_id, payment_id, expense_id)
        if entity is None:
            return None
        return schemas.PaymentExpenseRead.model_validate(entity)

    async def update_expense(
        self, tenant_id: UUID, payment_id: UUID, expense_id: UUID, payload: schemas.PaymentExpenseUpdate
    ) -> schemas.PaymentExpenseRead | None:
        existing = await self.repository.get_for_payment(tenant_id, payment_id, expense_id)
        if existing is None:
            return None
        data = payload.model_dump(exclude_unset=True)
        entity = await self.repository.update(tenant_id, expense_id, data)
        if entity is None:
            return None
        updated_payment = await self.payment_repository.recalculate_totals(tenant_id, payment_id)
        assert updated_payment is not None
        payment_schema = await self._load_payment(tenant_id, payment_id)
        expense = schemas.PaymentExpenseRead.model_validate(entity)
        await self.events.publish(
            "deal.payment.expense.updated",
            {
                "deal_id": str(payment_schema.deal_id),
                "policy_id": str(payment_schema.policy_id),
                "payment_id": str(payment_schema.id),
                "expense": _serialize_expense(expense),
            },
        )
        await self.events.publish(
            "deal.payment.updated",
            {
                "deal_id": str(payment_schema.deal_id),
                "policy_id": str(payment_schema.policy_id),
                "payment": _serialize_payment(payment_schema),
            },
        )
        return expense

    async def delete_expense(self, tenant_id: UUID, payment_id: UUID, expense_id: UUID) -> bool:
        existing = await self.repository.get_for_payment(tenant_id, payment_id, expense_id)
        if existing is None:
            return False
        deleted = await self.repository.delete(tenant_id, expense_id)
        if not deleted:
            return False
        updated_payment = await self.payment_repository.recalculate_totals(tenant_id, payment_id)
        if updated_payment is None:
            return True
        payment_schema = await self._load_payment(tenant_id, payment_id)
        await self.events.publish(
            "deal.payment.expense.deleted",
            {
                "deal_id": str(payment_schema.deal_id),
                "policy_id": str(payment_schema.policy_id),
                "payment_id": str(payment_schema.id),
                "expense": {"expense_id": str(expense_id)},
            },
        )
        await self.events.publish(
            "deal.payment.updated",
            {
                "deal_id": str(payment_schema.deal_id),
                "policy_id": str(payment_schema.policy_id),
                "payment": _serialize_payment(payment_schema),
            },
        )
        return True

    async def _load_payment(self, tenant_id: UUID, payment_id: UUID) -> schemas.PaymentRead:
        payment_entity = await self.payment_repository.get(tenant_id, payment_id)
        assert payment_entity is not None
        schema = schemas.PaymentRead.model_validate(payment_entity)
        expenses = await self.repository.list_for_payment(tenant_id, payment_id)
        incomes = await self.income_repository.list_for_payment(tenant_id, payment_id)
        schema.expenses = [schemas.PaymentExpenseRead.model_validate(item) for item in expenses]
        schema.incomes = [schemas.PaymentIncomeRead.model_validate(item) for item in incomes]
        return schema


class PaymentSyncService:
    def __init__(
        self,
        log_repository: repositories.PaymentSyncLogRepository,
        deal_repository: repositories.DealRepository,
    ) -> None:
        self.log_repository = log_repository
        self.deal_repository = deal_repository

    async def handle_payment_event(self, event: schemas.PaymentEvent) -> schemas.PaymentEventResult:
        record = await self.log_repository.upsert_from_event(event.tenant_id, event)
        if record and event.deal_id and event.status in {"received", "paid_out"}:
            await self.deal_repository.mark_won(event.tenant_id, event.deal_id)
        return schemas.PaymentEventResult(processed=record is not None)


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
