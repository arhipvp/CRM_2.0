from __future__ import annotations

from typing import Any, Iterable, Protocol
from uuid import UUID

from crm.domain import schemas
from crm.infrastructure import repositories


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
