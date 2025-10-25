from __future__ import annotations

import asyncio
import json
from datetime import date, datetime, timedelta, timezone
import logging
import re
from decimal import Decimal
from typing import Any, Iterable, Protocol, Sequence
from uuid import UUID, uuid4

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

from pydantic_core import PydanticUndefined
from sqlalchemy.exc import IntegrityError

from crm.domain import schemas
from crm.infrastructure import models, repositories
from crm.infrastructure.queues import DelayedTaskQueue, TaskReminderQueue
from crm.infrastructure.repositories import RepositoryError
from crm.infrastructure.task_events import TaskEventsPublisher


logger = logging.getLogger(__name__)


class ClientService:
    def __init__(self, repository: repositories.ClientRepository):
        self.repository = repository

    async def list_clients(self) -> Iterable[schemas.ClientRead]:
        clients = await self.repository.list()
        return [schemas.ClientRead.model_validate(client) for client in clients]

    async def create_client(self, payload: schemas.ClientCreate) -> schemas.ClientRead:
        entity = await self.repository.create(payload.model_dump())
        return schemas.ClientRead.model_validate(entity)

    async def get_client(self, client_id: UUID) -> schemas.ClientRead | None:
        entity = await self.repository.get(client_id)
        if entity is None:
            return None
        return schemas.ClientRead.model_validate(entity)

    async def update_client(
        self, client_id: UUID, payload: schemas.ClientUpdate
    ) -> schemas.ClientRead | None:
        entity = await self.repository.update(client_id, payload.model_dump(exclude_unset=True))
        if entity is None:
            return None
        return schemas.ClientRead.model_validate(entity)


class DealService:
    def __init__(self, repository: repositories.DealRepository):
        self.repository = repository

    async def list_deals(
        self, filters: schemas.DealFilters | None = None
    ) -> Iterable[schemas.DealRead]:
        deals = await self.repository.list(filters)
        return [schemas.DealRead.model_validate(deal) for deal in deals]

    async def create_deal(self, payload: schemas.DealCreate) -> schemas.DealRead:
        entity = await self.repository.create(payload.model_dump())
        return schemas.DealRead.model_validate(entity)

    async def get_deal(self, deal_id: UUID) -> schemas.DealRead | None:
        entity = await self.repository.get(deal_id)
        if entity is None:
            return None
        return schemas.DealRead.model_validate(entity)

    async def update_deal(
        self, deal_id: UUID, payload: schemas.DealUpdate
    ) -> schemas.DealRead | None:
        entity = await self.repository.update(deal_id, payload.model_dump(exclude_unset=True))
        if entity is None:
            return None
        return schemas.DealRead.model_validate(entity)

    async def mark_deal_won(self, deal_id: UUID) -> schemas.DealRead | None:
        entity = await self.repository.mark_won(deal_id)
        if entity is None:
            return None
        return schemas.DealRead.model_validate(entity)

    async def update_stage(
        self, deal_id: UUID, stage: schemas.DealStage
    ) -> schemas.DealRead | None:
        status = schemas.map_stage_to_deal_status(stage)
        entity = await self.repository.update(deal_id, {"status": status})
        if entity is None:
            return None
        return schemas.DealRead.model_validate(entity)

    async def get_stage_metrics(
        self, filters: schemas.DealFilters | None = None
    ) -> Iterable[schemas.DealStageMetric]:
        metrics = await self.repository.stage_metrics(filters)
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
        deal_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> schemas.DealJournalEntryList:
        items, total = await self.repository.list_entries(
            deal_id,
            limit=limit,
            offset=offset,
        )
        entries = [schemas.DealJournalEntryRead.model_validate(item) for item in items]
        return schemas.DealJournalEntryList(items=entries, total=total)

    async def append_entry(
        self,
        deal_id: UUID,
        payload: schemas.DealJournalEntryCreate,
    ) -> schemas.DealJournalEntryRead | None:
        entry = await self.repository.create_entry(
            deal_id,
            payload.model_dump(),
        )
        if entry is None:
            return None
        dto = schemas.DealJournalEntryRead.model_validate(entry)
        await self._publish_event(dto)
        return dto

    async def _publish_event(
        self,
        entry: schemas.DealJournalEntryRead,
    ) -> None:
        payload = {
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

    async def list_policies(self) -> Iterable[schemas.PolicyRead]:
        policies = await self.repository.list()
        return [self._to_schema(policy) for policy in policies]

    async def create_policy(self, payload: schemas.PolicyCreate) -> schemas.PolicyRead:
        entity = await self.repository.create(payload.model_dump())
        return self._to_schema(entity)

    async def get_policy(self, policy_id: UUID) -> schemas.PolicyRead | None:
        entity = await self.repository.get(policy_id)
        if entity is None:
            return None
        return self._to_schema(entity)

    async def update_policy(
        self, policy_id: UUID, payload: schemas.PolicyUpdate
    ) -> schemas.PolicyRead | None:
        entity = await self.repository.update(policy_id, payload.model_dump(exclude_unset=True))
        if entity is None:
            return None
        return self._to_schema(entity)

    async def list_policy_documents(
        self, policy_id: UUID
    ) -> Iterable[schemas.PolicyDocumentRead] | None:
        if self.policy_documents is None:  # pragma: no cover - defensive
            raise RepositoryError("policy_documents_repository_not_configured")
        policy = await self.repository.get(policy_id)
        if policy is None:
            return None
        items = await self.policy_documents.list(policy_id)
        return [self._policy_document_to_schema(item) for item in items]

    async def attach_document(
        self, policy_id: UUID, document_id: UUID
    ) -> schemas.PolicyDocumentRead | None:
        if self.policy_documents is None:  # pragma: no cover - defensive
            raise RepositoryError("policy_documents_repository_not_configured")
        entity = await self.policy_documents.attach(policy_id, document_id)
        if entity is None:
            return None
        return self._policy_document_to_schema(entity)

    async def detach_document(
        self, policy_id: UUID, document_id: UUID
    ) -> bool | None:
        if self.policy_documents is None:  # pragma: no cover - defensive
            raise RepositoryError("policy_documents_repository_not_configured")
        policy = await self.repository.get(policy_id)
        if policy is None:
            return None
        return await self.policy_documents.detach(policy_id, document_id)

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
        deal_id: UUID,
        *,
        statuses: Sequence[str] | None = None,
        insurance_company: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> Iterable[schemas.CalculationRead]:
        items = await self.repository.list(
            deal_id,
            statuses=statuses,
            insurance_company=insurance_company,
            date_from=date_from,
            date_to=date_to,
        )
        return [self._to_schema(calculation) for calculation in items]

    async def create_calculation(
        self,
        deal_id: UUID,
        payload: schemas.CalculationCreate,
    ) -> schemas.CalculationRead:
        range_value = payload.validity_period
        data = payload.model_dump(exclude={"validity_period"})
        data["validity_period"] = self._date_range_to_pg(range_value)
        try:
            calculation = await self.repository.create(deal_id, data)
        except repositories.RepositoryError as exc:
            if str(exc) == "deal_not_found":
                raise
            raise
        calculation = await self.repository.get(deal_id, calculation.id) or calculation
        result = self._to_schema(calculation)
        await self._publish_event("deal.calculation.created", calculation)
        return result

    async def get_calculation(
        self,
        deal_id: UUID,
        calculation_id: UUID,
    ) -> schemas.CalculationRead | None:
        calculation = await self.repository.get(deal_id, calculation_id)
        if calculation is None:
            return None
        return self._to_schema(calculation)

    async def update_calculation(
        self,
        deal_id: UUID,
        calculation_id: UUID,
        payload: schemas.CalculationUpdate,
    ) -> schemas.CalculationRead | None:
        calculation = await self.repository.get(deal_id, calculation_id)
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
        deal_id: UUID,
        calculation_id: UUID,
    ) -> bool:
        calculation = await self.repository.get(deal_id, calculation_id)
        if calculation is None:
            return False
        if calculation.policy is not None:
            await self.policies.assign_calculation(calculation.policy.id, None)
            calculation.policy = None
        await self.repository.delete(calculation)
        await self._publish_event("deal.calculation.deleted", calculation)
        return True

    async def change_status(
        self,
        deal_id: UUID,
        calculation_id: UUID,
        payload: schemas.CalculationStatusChange,
    ) -> schemas.CalculationRead | None:
        calculation = await self.repository.get(deal_id, calculation_id)
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
            linked_policy = await self._resolve_policy(deal_id, calculation.id, payload.policy_id)
            if linked_policy is None and payload.policy_id is not None:
                raise repositories.RepositoryError("policy_not_found")
            if linked_policy is not None:
                if (
                    calculation.policy is not None
                    and calculation.policy.id != linked_policy.id
                ):
                    await self.policies.assign_calculation(
                        calculation.policy.id, None
                    )
                    calculation.policy = None
                await self.policies.assign_calculation(linked_policy.id, calculation.id)
        elif new_status == "archived" and calculation.policy is not None:
            detach_policy = True

        updated = await self.repository.update(calculation, {"status": new_status})

        if detach_policy and updated.policy is not None:
            await self.policies.assign_calculation(updated.policy.id, None)

        updated = await self.repository.get(deal_id, calculation_id) or updated

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
        deal_id: UUID,
        calculation_id: UUID,
        policy_id: UUID | None,
    ) -> schemas.PolicyRead | None:
        if policy_id is None:
            return None
        policy = await self.policy_service.get_policy(policy_id)
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

class TaskServiceError(RuntimeError):
    def __init__(self, code: str, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.details = details or {}


class TaskService:
    FINAL_STATUSES: set[schemas.TaskStatusCode] = {
        schemas.TaskStatusCode.COMPLETED,
        schemas.TaskStatusCode.CANCELLED,
    }

    ALLOWED_TRANSITIONS: dict[schemas.TaskStatusCode, tuple[schemas.TaskStatusCode, ...]] = {
        schemas.TaskStatusCode.PENDING: (
            schemas.TaskStatusCode.IN_PROGRESS,
            schemas.TaskStatusCode.COMPLETED,
            schemas.TaskStatusCode.CANCELLED,
        ),
        schemas.TaskStatusCode.SCHEDULED: (
            schemas.TaskStatusCode.PENDING,
            schemas.TaskStatusCode.IN_PROGRESS,
            schemas.TaskStatusCode.CANCELLED,
        ),
        schemas.TaskStatusCode.IN_PROGRESS: (
            schemas.TaskStatusCode.COMPLETED,
            schemas.TaskStatusCode.CANCELLED,
        ),
        schemas.TaskStatusCode.COMPLETED: (),
        schemas.TaskStatusCode.CANCELLED: (),
    }

    def __init__(
        self,
        repository: repositories.TaskRepository,
        status_repository: repositories.TaskStatusRepository,
        reminder_repository: repositories.TaskReminderRepository,
        delayed_queue: DelayedTaskQueue,
        reminder_queue: TaskReminderQueue,
        events_publisher: TaskEventsPublisher,
    ) -> None:
        self.repository = repository
        self.statuses = status_repository
        self.reminders = reminder_repository
        self.delayed_queue = delayed_queue
        self.reminder_queue = reminder_queue
        self.events = events_publisher

    async def list_tasks(
        self, filters: schemas.TaskFilters | None = None
    ) -> Iterable[schemas.TaskRead]:
        tasks = await self.repository.list(filters)
        return [schemas.TaskRead.model_validate(task) for task in tasks]

    async def create_task(self, payload: schemas.TaskCreate) -> schemas.TaskRead:
        status = payload.initial_status
        status_entity = await self.statuses.get(status.value)
        if status_entity is None:
            raise TaskServiceError("unknown_status", f"Unknown task status: {status.value}")
        if status is schemas.TaskStatusCode.SCHEDULED and payload.scheduled_for is None:
            raise TaskServiceError("scheduled_for_required", "scheduledFor is required for scheduled tasks")

        data = {
            "title": payload.subject,
            "description": payload.description,
            "status_code": status.value,
            "due_at": payload.due_at,
            "scheduled_for": payload.scheduled_for,
            "payload": self._build_payload(payload),
        }

        try:
            task = await self.repository.create(data)
        except RepositoryError as exc:
            raise TaskServiceError(str(exc), "Unable to create task") from exc

        if status is schemas.TaskStatusCode.SCHEDULED and payload.scheduled_for is not None:
            await self.delayed_queue.schedule(task.id, payload.scheduled_for)

        await self.events.task_created(task)
        return schemas.TaskRead.model_validate(task)

    async def get_task(self, task_id: UUID) -> schemas.TaskRead | None:
        entity = await self.repository.get(task_id)
        if entity is None:
            return None
        return schemas.TaskRead.model_validate(entity)

    async def update_task(
        self, task_id: UUID, payload: schemas.TaskUpdate
    ) -> schemas.TaskRead | None:
        task = await self.repository.get(task_id)
        if task is None:
            return None

        current_status = self._to_status(task.status_code)
        next_status = payload.status or current_status
        status_changed = payload.status is not None and payload.status != current_status

        if payload.status and payload.status != current_status:
            self._ensure_transition(current_status, payload.status)

        if (
            payload.completed_at is not PydanticUndefined
            and payload.completed_at is not None
            and next_status != schemas.TaskStatusCode.COMPLETED
        ):
            raise TaskServiceError(
                "invalid_status_transition",
                "completedAt can only be set for completed tasks",
                details={"current": current_status.value, "next": next_status.value},
            )

        if payload.status is schemas.TaskStatusCode.COMPLETED and payload.completed_at is None:
            payload.completed_at = datetime.now(timezone.utc)

        if (
            payload.cancelled_reason is not PydanticUndefined
            and next_status != schemas.TaskStatusCode.CANCELLED
        ):
            raise TaskServiceError(
                "invalid_status_transition",
                "cancelledReason can only be modified for cancelled tasks",
                details={"current": current_status.value, "next": next_status.value},
            )

        if (
            payload.status is None
            and current_status in self.FINAL_STATUSES
            and payload.due_at is PydanticUndefined
            and payload.completed_at is PydanticUndefined
            and payload.cancelled_reason is PydanticUndefined
            and payload.scheduled_for is PydanticUndefined
        ):
            return schemas.TaskRead.model_validate(task)

        if payload.due_at is not PydanticUndefined:
            task.due_at = payload.due_at

        if payload.completed_at is not PydanticUndefined:
            task.completed_at = payload.completed_at

        if payload.status is schemas.TaskStatusCode.CANCELLED:
            reason = (
                payload.cancelled_reason
                if payload.cancelled_reason is not PydanticUndefined
                else task.cancelled_reason
            )
            if reason is None or not str(reason).strip():
                raise TaskServiceError(
                    "cancelled_reason_required",
                    "cancelledReason is required when cancelling a task",
                )
            task.cancelled_reason = str(reason).strip()
            task.scheduled_for = None
        elif payload.status:
            task.cancelled_reason = None

        if payload.scheduled_for is not PydanticUndefined:
            task.scheduled_for = payload.scheduled_for

        if status_changed:
            task.status_code = payload.status.value
            if current_status is schemas.TaskStatusCode.SCHEDULED:
                task.scheduled_for = payload.scheduled_for if payload.scheduled_for is not PydanticUndefined else None

        if next_status is schemas.TaskStatusCode.SCHEDULED and task.scheduled_for is None:
            raise TaskServiceError("scheduled_for_required", "scheduledFor is required when scheduling a task")

        should_remove_from_queue = (
            current_status is schemas.TaskStatusCode.SCHEDULED and next_status != schemas.TaskStatusCode.SCHEDULED
        ) or next_status in self.FINAL_STATUSES

        saved = await self.repository.save(task)

        if should_remove_from_queue:
            await self.delayed_queue.remove(saved.id)
        elif (
            next_status is schemas.TaskStatusCode.SCHEDULED
            and saved.scheduled_for is not None
            and (status_changed or payload.scheduled_for is not PydanticUndefined)
        ):
            await self.delayed_queue.schedule(saved.id, saved.scheduled_for)

        if status_changed:
            await self.events.task_status_changed(saved, current_status)

        return schemas.TaskRead.model_validate(saved)

    async def schedule_task(
        self, task_id: UUID, payload: schemas.TaskScheduleRequest
    ) -> schemas.TaskRead | None:
        update_payload = schemas.TaskUpdate(
            status=schemas.TaskStatusCode.SCHEDULED,
            scheduled_for=payload.scheduled_for,
        )
        return await self.update_task(task_id, update_payload)

    async def complete_task(
        self, task_id: UUID, payload: schemas.TaskCompleteRequest | None = None
    ) -> schemas.TaskRead | None:
        completed_at = payload.completed_at if payload else None
        update_payload = schemas.TaskUpdate(
            status=schemas.TaskStatusCode.COMPLETED,
            completed_at=completed_at,
        )
        return await self.update_task(task_id, update_payload)

    async def create_reminder(
        self, task_id: UUID, payload: schemas.TaskReminderCreate
    ) -> schemas.TaskReminderRead | None:
        task = await self.repository.get(task_id)
        if task is None:
            return None

        data = {
            "task_id": task_id,
            "remind_at": payload.remind_at,
            "channel": payload.channel.value,
        }

        try:
            reminder = await self.reminders.create(data)
        except RepositoryError as exc:
            code = str(exc)
            if code == "task_reminder_conflict":
                message = "Reminder already exists for this task"
            elif code == "task_not_found":
                message = "Task not found"
            else:
                message = "Unable to create reminder"
            raise TaskServiceError(code, message) from exc

        await self.reminder_queue.schedule(reminder.id, reminder.remind_at)
        return schemas.TaskReminderRead.model_validate(reminder)

    def _build_payload(self, payload: schemas.TaskCreate) -> dict[str, Any]:
        data: dict[str, Any] = dict(payload.payload or {})
        data["assigneeId"] = str(payload.assignee_id)
        data["assignee_id"] = str(payload.assignee_id)
        data["authorId"] = str(payload.author_id)
        data["author_id"] = str(payload.author_id)

        if payload.priority:
            data["priority"] = payload.priority.value

        if payload.context:
            normalized_context: dict[str, Any] = {}
            for key, value in payload.context.items():
                if isinstance(key, str):
                    normalized_context[self._to_camel_case(key)] = value
            deal_id = self._extract_identifier(payload.context, ("dealId", "deal_id"))
            client_id = self._extract_identifier(payload.context, ("clientId", "client_id"))
            policy_id = self._extract_identifier(payload.context, ("policyId", "policy_id"))
            if deal_id:
                data["dealId"] = deal_id
                data["deal_id"] = deal_id
                normalized_context["dealId"] = deal_id
            if client_id:
                data["clientId"] = client_id
                data["client_id"] = client_id
                normalized_context["clientId"] = client_id
            if policy_id:
                data["policyId"] = policy_id
                data["policy_id"] = policy_id
                normalized_context["policyId"] = policy_id
            if normalized_context:
                data["context"] = normalized_context

        return data

    @staticmethod
    def _extract_identifier(context: dict[str, Any], keys: tuple[str, str]) -> str | None:
        for key in keys:
            value = context.get(key)
            if isinstance(value, UUID):
                return str(value)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    @staticmethod
    def _to_camel_case(value: str) -> str:
        parts = re.split(r"[_\-\s]+", value.strip())
        if not parts:
            return value
        first, *rest = parts
        return first.lower() + "".join(part.capitalize() for part in rest)

    @classmethod
    def _to_status(cls, value: str) -> schemas.TaskStatusCode:
        try:
            return schemas.TaskStatusCode(value)
        except ValueError as exc:  # pragma: no cover - defensive
            raise TaskServiceError("invalid_status", f"Unknown task status: {value}") from exc

    def _ensure_transition(
        self, current: schemas.TaskStatusCode, next_status: schemas.TaskStatusCode
    ) -> None:
        if current in self.FINAL_STATUSES:
            raise TaskServiceError(
                "invalid_status_transition",
                f"Task in status {current.value} cannot transition to {next_status.value}",
                details={"current": current.value, "next": next_status.value},
            )
        allowed = self.ALLOWED_TRANSITIONS.get(current, tuple())
        if next_status not in allowed:
            raise TaskServiceError(
                "invalid_status_transition",
                f"Transition from {current.value} to {next_status.value} is not allowed",
                details={"current": current.value, "next": next_status.value},
            )


class TaskReminderProcessor:
    def __init__(
        self,
        queue: TaskReminderQueue,
        reminder_repository: repositories.TaskReminderRepository,
        events_publisher: TaskEventsPublisher,
        *,
        batch_size: int = 100,
        retry_delay_ms: int = 5000,
    ) -> None:
        self.queue = queue
        self.reminders = reminder_repository
        self.events = events_publisher
        self.batch_size = batch_size
        self.retry_delay_ms = max(retry_delay_ms, 1000)
        self.logger = logging.getLogger(self.__class__.__name__)

    async def process_due_reminders(self) -> int:
        claimed = await self.queue.claim_due(limit=self.batch_size)
        processed = 0

        for reminder_id, score in claimed:
            try:
                reminder_uuid = UUID(reminder_id)
            except ValueError:
                self.logger.warning("Invalid reminder id %s in queue", reminder_id)
                continue

            reminder = await self.reminders.get(reminder_uuid)
            if reminder is None:
                self.logger.debug("Reminder %s no longer exists; skipping", reminder_id)
                continue

            try:
                await self.events.task_reminder(reminder)
                processed += 1
            except Exception as exc:  # noqa: BLE001
                self.logger.error("Error while processing reminder %s: %s", reminder_id, exc)
                await self._reschedule(reminder_id, int(score))

        return processed

    async def _reschedule(self, reminder_id: str, original_score: int) -> None:
        next_attempt_ms = max(
            original_score,
            int(datetime.now(timezone.utc).timestamp() * 1000) + self.retry_delay_ms,
        )
        next_attempt = datetime.fromtimestamp(next_attempt_ms / 1000, tz=timezone.utc)
        try:
            await self.queue.schedule(reminder_id, next_attempt)
            self.logger.debug(
                "Reminder %s rescheduled for %s", reminder_id, next_attempt.isoformat()
            )
        except Exception as exc:  # noqa: BLE001
            self.logger.error(
                "Failed to reschedule reminder %s: %s", reminder_id, exc
            )



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
        deal_id: UUID,
        policy_id: UUID,
        payload: schemas.PaymentCreate,
    ) -> schemas.PaymentRead:
        data = payload.model_dump(exclude_unset=True)
        normalized_currency = self._normalize_currency(data["currency"])
        if not normalized_currency:
            raise repositories.RepositoryError("currency_mismatch")
        data["currency"] = normalized_currency
        payment = await self.payments.create_payment(deal_id, policy_id, data)
        payment = await self._finalize_payment(payment)
        await self._publish_payment_event("deal.payment.created", payment)
        return payment

    async def get_payment(
        self,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        *,
        include: Sequence[str] | None = None,
    ) -> schemas.PaymentRead | None:
        include = include or []
        payment = await self.payments.get_payment(
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
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        payload: schemas.PaymentUpdate,
    ) -> schemas.PaymentRead | None:
        payment = await self.payments.get_payment(deal_id, policy_id, payment_id)
        if payment is None:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        forced_status = None
        if "status" in update_data:
            status_value = str(update_data["status"])
            if status_value == "cancelled":
                forced_status = status_value
            update_data.pop("status", None)

        if "currency" in update_data:
            new_currency_raw = update_data.get("currency")
            if new_currency_raw is None:
                update_data.pop("currency", None)
            else:
                normalized_currency = self._normalize_currency(str(new_currency_raw))
                if not normalized_currency:
                    raise repositories.RepositoryError("currency_mismatch")
                current_currency_raw = payment.currency
                current_currency = self._normalize_currency(current_currency_raw)
                if normalized_currency != current_currency:
                    if payment.incomes_total or payment.expenses_total:
                        raise repositories.RepositoryError("payment_has_transactions")
                    update_data["currency"] = normalized_currency
                elif current_currency_raw != normalized_currency:
                    update_data["currency"] = normalized_currency
                else:
                    update_data.pop("currency", None)

        if "actual_date" in update_data and update_data["actual_date"] is not None:
            actual_date = update_data["actual_date"]
            planned_date = update_data.get("planned_date", payment.planned_date)
            if planned_date is not None and actual_date < planned_date:
                raise repositories.RepositoryError("actual_date_before_planned_date")
            local_today = datetime.now(timezone.utc).astimezone().date()
            if actual_date > local_today:
                raise repositories.RepositoryError("actual_date_in_future")

        await self.payments.update_payment(payment, update_data)
        payment = await self._finalize_payment(payment, forced_status=forced_status)
        await self._publish_payment_event("deal.payment.updated", payment)
        return payment

    async def delete_payment(
        self,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
    ) -> bool:
        payment = await self.payments.get_payment(deal_id, policy_id, payment_id)
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
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        payload: schemas.PaymentIncomeCreate,
    ) -> tuple[schemas.PaymentRead | None, schemas.PaymentIncomeRead | None]:
        payment = await self.payments.get_payment(deal_id, policy_id, payment_id)
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
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        income_id: UUID,
        payload: schemas.PaymentIncomeUpdate,
    ) -> tuple[schemas.PaymentRead | None, schemas.PaymentIncomeRead | None]:
        payment = await self.payments.get_payment(deal_id, policy_id, payment_id)
        if payment is None:
            return None, None
        income = await self.incomes.get_income(payment_id, income_id)
        if income is None:
            return None, None
        previous = schemas.PaymentIncomeRead.model_validate(income)
        update_data = payload.model_dump(exclude_unset=True)
        requested_currency = update_data.get("currency", income.currency)
        normalized_currency = self._validate_transaction_input(
            payment,
            currency=str(requested_currency) if requested_currency is not None else None,
            posted_at=update_data.get("posted_at"),
        )
        if "currency" in update_data and normalized_currency is not None:
            update_data["currency"] = normalized_currency
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
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        income_id: UUID,
        *,
        deleted_by_id: UUID | None = None,
    ) -> schemas.PaymentRead | None:
        payment = await self.payments.get_payment(deal_id, policy_id, payment_id)
        if payment is None:
            return None
        income = await self.incomes.get_income(payment_id, income_id)
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
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        payload: schemas.PaymentExpenseCreate,
    ) -> tuple[schemas.PaymentRead | None, schemas.PaymentExpenseRead | None]:
        payment = await self.payments.get_payment(deal_id, policy_id, payment_id)
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
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        expense_id: UUID,
        payload: schemas.PaymentExpenseUpdate,
    ) -> tuple[schemas.PaymentRead | None, schemas.PaymentExpenseRead | None]:
        payment = await self.payments.get_payment(deal_id, policy_id, payment_id)
        if payment is None:
            return None, None
        expense = await self.expenses.get_expense(payment_id, expense_id)
        if expense is None:
            return None, None
        previous = schemas.PaymentExpenseRead.model_validate(expense)
        update_data = payload.model_dump(exclude_unset=True)
        requested_currency = update_data.get("currency", expense.currency)
        normalized_currency = self._validate_transaction_input(
            payment,
            currency=str(requested_currency) if requested_currency is not None else None,
            posted_at=update_data.get("posted_at"),
        )
        if "currency" in update_data and normalized_currency is not None:
            update_data["currency"] = normalized_currency
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
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        expense_id: UUID,
        *,
        deleted_by_id: UUID | None = None,
    ) -> schemas.PaymentRead | None:
        payment = await self.payments.get_payment(deal_id, policy_id, payment_id)
        if payment is None:
            return None
        expense = await self.expenses.get_expense(payment_id, expense_id)
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

    @staticmethod
    def _build_income_event_payload(
        income: schemas.PaymentIncomeRead,
        *,
        include_identifier: bool,
    ) -> dict[str, Any]:
        payload = income.model_dump(mode="json")
        identifier = payload.pop("id", None)
        if include_identifier and identifier is not None:
            payload["income_id"] = identifier
        return payload

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
            payload["income"] = self._build_income_event_payload(income, include_identifier=True)
        if previous is not None:
            payload["previous"] = self._build_income_event_payload(previous, include_identifier=False)
        if deleted_id is not None:
            payload["income"] = {
                "income_id": str(deleted_id),
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by_id": str(deleted_by_id) if deleted_by_id else None,
            }
        await self.events.publish(routing_key, payload)

    @staticmethod
    def _build_expense_event_payload(
        expense: schemas.PaymentExpenseRead,
        *,
        include_identifier: bool,
    ) -> dict[str, Any]:
        payload = expense.model_dump(mode="json")
        identifier = payload.pop("id", None)
        if include_identifier and identifier is not None:
            payload["expense_id"] = identifier
        return payload

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
            payload["expense"] = self._build_expense_event_payload(expense, include_identifier=True)
        if previous is not None:
            payload["previous"] = self._build_expense_event_payload(previous, include_identifier=False)
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
        self, payload: schemas.SyncPermissionsDto
    ) -> schemas.SyncPermissionsResponse:
        job = await self.repository.create_job(payload, self.queue_name)
        job_payload = {
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


class NotificationError(RuntimeError):
    pass


class NotificationTemplateConflictError(NotificationError):
    pass


class DuplicateNotificationError(NotificationError):
    pass


class NotificationDispatchError(NotificationError):
    pass


class NotificationDispatcherProtocol(Protocol):
    async def publish_rabbit(self, exchange: str, routing_key: str, message: dict[str, Any]) -> None:  # pragma: no cover - protocol definition
        ...

    async def publish_redis(self, channel: str, message: dict[str, Any]) -> None:  # pragma: no cover - protocol definition
        ...


class NotificationTemplateService:
    def __init__(
        self,
        repository: repositories.NotificationTemplateRepository,
        default_locale: str,
    ) -> None:
        self.repository = repository
        self.default_locale = default_locale

    async def list_templates(
        self, filters: schemas.NotificationTemplateListFilters | None = None
    ) -> list[schemas.NotificationTemplateRead]:
        entities = await self.repository.list(filters)
        return [schemas.NotificationTemplateRead.model_validate(entity) for entity in entities]

    async def create_template(
        self, payload: schemas.NotificationTemplateCreate
    ) -> schemas.NotificationTemplateRead:
        data = payload.model_dump()
        locale = payload.locale or self.default_locale
        data["locale"] = locale
        if "metadata" in data:
            data["template_metadata"] = data.pop("metadata")
        try:
            entity = await self.repository.create(data)
        except RepositoryError as exc:
            raise NotificationTemplateConflictError("template_conflict") from exc
        return schemas.NotificationTemplateRead.model_validate(entity)


class NotificationStreamService:
    def __init__(self, retry_interval_ms: int) -> None:
        self._retry_interval_ms = retry_interval_ms
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._lock = asyncio.Lock()

    async def publish(self, event_type: str, payload: dict[str, Any]) -> None:
        message = {
            "event": event_type,
            "data": {"eventType": event_type, "payload": payload},
            "retry": self._retry_interval_ms,
        }
        async with self._lock:
            subscribers = list(self._subscribers)
        for queue in subscribers:
            await queue.put(message)

    async def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        async with self._lock:
            self._subscribers.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            self._subscribers.discard(queue)


class TelegramSendResult(Protocol):
    accepted: bool
    message_id: str | None
    error: str | None


class TelegramService:
    def __init__(
        self,
        *,
        enabled: bool,
        mock: bool,
        bot_token: str | None,
        default_chat_id: str | None,
    ) -> None:
        self.enabled = enabled
        self.mock = mock
        self.bot_token = bot_token
        self.default_chat_id = default_chat_id

    async def send(self, chat_id: str | None, message: str) -> dict[str, Any]:
        if not self.enabled:
            return {
                "accepted": True,
                "messageId": None,
                "error": None,
                "reason": "telegram_disabled",
                "skipped": True,
            }
        target_chat = chat_id or self.default_chat_id
        if not target_chat:
            return {"accepted": False, "error": "missing_chat_id", "messageId": None}
        if not self.bot_token:
            return {"accepted": False, "error": "missing_bot_token", "messageId": None}
        if self.mock:
            message_id = f"mock-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
            return {"accepted": True, "messageId": message_id, "error": None}

        import httpx

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = {"chat_id": target_chat, "text": message}
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, timeout=10)
            if response.status_code >= 400:
                return {
                    "accepted": False,
                    "error": f"telegram_http_{response.status_code}",
                    "messageId": None,
                }
            data = response.json()
            if not data.get("ok", False):
                return {
                    "accepted": False,
                    "error": "telegram_response_not_ok",
                    "messageId": None,
                }
            message_id = data.get("result", {}).get("message_id")
            return {
                "accepted": True,
                "messageId": str(message_id) if message_id is not None else None,
                "error": None,
            }
        except Exception:  # noqa: BLE001
            return {"accepted": False, "error": "telegram_request_failed", "messageId": None}


class NotificationEventsService:
    def __init__(
        self,
        repository: repositories.NotificationEventRepository,
        stream: NotificationStreamService,
        telegram: TelegramService,
    ) -> None:
        self.repository = repository
        self.stream = stream
        self.telegram = telegram
        self.logger = logging.getLogger(self.__class__.__name__)

    async def handle_incoming(self, dto: schemas.NotificationEventIngest) -> schemas.NotificationEvent:
        existing = await self.repository.get_by_event_id(dto.id)
        if existing is not None:
            self.logger.debug("Event %s (%s) already processed", dto.id, dto.type)
            return schemas.NotificationEvent.model_validate(existing)

        entity = await self.repository.create(
            {
                "event_id": dto.id,
                "event_type": dto.type,
                "payload": dto.data,
            }
        )

        await self.stream.publish(dto.type, dto.data)

        chat_id = dto.chat_id
        if chat_id is None:
            recipient = next(
                (item for item in dto.data.get("recipients", []) if item.get("telegramId")),
                None,
            )
            if recipient:
                chat_id = str(recipient.get("telegramId"))

        message_body = self._compose_telegram_message(dto)
        send_result = await self.telegram.send(chat_id, message_body)
        await self._handle_send_result(entity.id, send_result)

        refreshed = await self.repository.get_by_event_id(dto.id)
        return schemas.NotificationEvent.model_validate(refreshed or entity)

    async def handle_telegram_delivery_update(
        self, dto: schemas.TelegramDeliveryWebhook
    ) -> schemas.NotificationEvent | None:
        entity = await self.repository.get_by_telegram_message_id(dto.message_id)
        if entity is None:
            self.logger.warning(
                "Received Telegram delivery status for unknown message %s", dto.message_id
            )
            return None

        delivered = dto.status is schemas.TelegramDeliveryWebhookStatus.DELIVERED
        updated = await self.repository.update(
            entity.id,
            {
                "delivered_to_telegram": delivered,
                "telegram_delivery_status": dto.status.value,
                "telegram_delivery_reason": dto.reason,
                "telegram_delivery_occurred_at": dto.occurred_at,
            },
        )

        event_type = (
            "notifications.telegram.delivery"
            if delivered
            else "notifications.telegram.error"
        )
        await self.stream.publish(
            event_type,
            {
                "notificationId": str(entity.id),
                "messageId": dto.message_id,
                "status": dto.status.value,
                "reason": dto.reason,
                "occurredAt": dto.occurred_at.isoformat(),
            },
        )
        return schemas.NotificationEvent.model_validate(updated or entity)

    def _compose_telegram_message(self, dto: schemas.NotificationEventIngest) -> str:
        payload_preview = json.dumps(dto.data, ensure_ascii=False, indent=2, default=str)
        return f"{dto.type}\n{dto.time.isoformat()}\n\n{payload_preview}"

    async def _handle_send_result(self, notification_id: UUID, send_result: dict[str, Any]) -> None:
        skipped = bool(send_result.get("skipped"))
        accepted = bool(send_result.get("accepted")) or skipped
        message_id = send_result.get("messageId")
        error = send_result.get("error")
        reason = send_result.get("reason") or (None if accepted else error)
        occurred_at = None if skipped else (datetime.now(timezone.utc) if accepted else None)
        status = "skipped" if skipped else ("sent" if accepted else "failed")
        await self.repository.update(
            notification_id,
            {
                "delivered_to_telegram": False,
                "telegram_message_id": message_id,
                "telegram_delivery_status": status,
                "telegram_delivery_reason": reason,
                "telegram_delivery_occurred_at": occurred_at,
            },
        )
        event_type = (
            "notifications.telegram.skipped"
            if skipped
            else ("notifications.telegram.sent" if accepted else "notifications.telegram.error")
        )
        await self.stream.publish(
            event_type,
            {
                "notificationId": str(notification_id),
                "messageId": message_id,
                "status": status,
                "reason": reason or error,
            },
        )
        if not accepted:
            raise NotificationDispatchError("notification_dispatch_failed")


class NotificationService:
    def __init__(
        self,
        repository: repositories.NotificationRepository,
        attempts: repositories.NotificationAttemptRepository,
        events_repository: repositories.NotificationEventRepository,
        dispatcher: NotificationDispatcherProtocol,
        events_service: NotificationEventsService,
        *,
        rabbit_exchange: str,
        rabbit_routing_key: str,
        redis_channel: str,
        retry_attempts: int,
        retry_delay_ms: int,
    ) -> None:
        self.repository = repository
        self.attempts = attempts
        self.events_repository = events_repository
        self.dispatcher = dispatcher
        self.events_service = events_service
        self.rabbit_exchange = rabbit_exchange
        self.rabbit_routing_key = rabbit_routing_key
        self.redis_channel = redis_channel
        self.retry_attempts = retry_attempts
        self.retry_delay_ms = retry_delay_ms
        self.logger = logging.getLogger(self.__class__.__name__)

    async def enqueue(self, payload: schemas.NotificationCreate) -> schemas.NotificationRead:
        recipients = [recipient.model_dump(by_alias=True) for recipient in payload.recipients]
        data = {
            "event_key": payload.event_key,
            "payload": payload.payload,
            "recipients": recipients,
            "channel_overrides": payload.channel_overrides or None,
            "deduplication_key": payload.deduplication_key,
        }
        try:
            entity = await self.repository.create(data)
        except IntegrityError as exc:
            raise DuplicateNotificationError("duplicate_notification") from exc

        message = {
            "notificationId": str(entity.id),
            "eventKey": entity.event_key,
            "payload": entity.payload,
            "recipients": recipients,
            "channelOverrides": entity.channel_overrides or [],
            "deduplicationKey": entity.deduplication_key,
        }

        attempt_counter = {"value": 0}

        try:
            await self._execute_with_retry(
                "rabbitmq",
                lambda: self._publish_rabbit(entity.id, message, attempt_counter),
            )
            await self._execute_with_retry(
                "redis",
                lambda: self._publish_redis(entity.id, message, attempt_counter),
            )
            await self._execute_with_retry(
                "events-service",
                lambda: self._dispatch_internal(payload, entity.id, message, attempt_counter),
            )
            await self.repository.update(
                entity.id,
                {
                    "status": schemas.NotificationStatus.PROCESSED.value,
                    "last_error": None,
                },
            )
        except Exception as exc:  # noqa: BLE001
            error_message = str(exc)
            await self.repository.update(
                entity.id,
                {
                    "status": schemas.NotificationStatus.FAILED.value,
                    "last_error": error_message,
                },
            )
            self.logger.error("Failed to dispatch notification %s: %s", entity.id, error_message)
            raise NotificationDispatchError("notification_dispatch_failed") from exc

        refreshed = await self.repository.get_with_attempts(entity.id)
        return schemas.NotificationRead.model_validate(refreshed or entity)

    async def get_status(
        self, notification_id: UUID
    ) -> schemas.NotificationStatusResponse | None:
        entity = await self.repository.get_with_attempts(notification_id)
        if entity is None:
            return None
        events = await self.events_repository.list_for_notification(notification_id)
        attempts = entity.attempts or []
        channels = sorted({attempt.channel for attempt in attempts})
        delivered_event = next(
            (
                event
                for event in events
                if event.delivered_to_telegram
                or (event.telegram_delivery_status or "").lower() == "delivered"
            ),
            None,
        )
        delivered_at = (
            delivered_event.telegram_delivery_occurred_at if delivered_event else None
        )
        status = "delivered" if delivered_event else entity.status
        return schemas.NotificationStatusResponse(
            id=entity.id,
            status=status,
            attempts=len(attempts),
            channels=channels,
            delivered_at=delivered_at,
        )

    async def _publish_rabbit(
        self,
        notification_id: UUID,
        message: dict[str, Any],
        counter: dict[str, int],
    ) -> None:
        counter["value"] += 1
        attempt_number = counter["value"]
        try:
            await self.dispatcher.publish_rabbit(
                self.rabbit_exchange, self.rabbit_routing_key, message
            )
            await self._record_attempt(
                notification_id,
                attempt_number,
                "rabbitmq",
                "success",
                {"exchange": self.rabbit_exchange, "routingKey": self.rabbit_routing_key},
            )
            await self.repository.update(
                notification_id,
                {"status": schemas.NotificationStatus.QUEUED.value},
            )
        except Exception as exc:  # noqa: BLE001
            await self._record_attempt(
                notification_id,
                attempt_number,
                "rabbitmq",
                "failure",
                {"exchange": self.rabbit_exchange, "routingKey": self.rabbit_routing_key},
                str(exc),
            )
            raise

    async def _publish_redis(
        self,
        notification_id: UUID,
        message: dict[str, Any],
        counter: dict[str, int],
    ) -> None:
        counter["value"] += 1
        attempt_number = counter["value"]
        try:
            await self.dispatcher.publish_redis(self.redis_channel, message)
            await self._record_attempt(
                notification_id,
                attempt_number,
                "redis",
                "success",
                {"channel": self.redis_channel},
            )
        except Exception as exc:  # noqa: BLE001
            await self._record_attempt(
                notification_id,
                attempt_number,
                "redis",
                "failure",
                {"channel": self.redis_channel},
                str(exc),
            )
            raise

    async def _dispatch_internal(
        self,
        payload: schemas.NotificationCreate,
        notification_id: UUID,
        message: dict[str, Any],
        counter: dict[str, int],
    ) -> None:
        counter["value"] += 1
        attempt_number = counter["value"]
        chat_id = next(
            (recipient.telegram_id for recipient in payload.recipients if recipient.telegram_id),
            None,
        )
        event_payload = dict(message["payload"])
        event_payload.update(
            {
                "notificationId": str(notification_id),
                "recipients": [r.model_dump(by_alias=True) for r in payload.recipients],
                "channelOverrides": payload.channel_overrides or [],
            }
        )
        dto = schemas.NotificationEventIngest(
            id=uuid4(),
            source="crm.notifications",
            type=payload.event_key,
            time=datetime.now(timezone.utc),
            data=event_payload,
            chat_id=chat_id,
        )
        try:
            await self.events_service.handle_incoming(dto)
            await self._record_attempt(
                notification_id,
                attempt_number,
                "events-service",
                "success",
                {"chatId": chat_id},
            )
        except Exception as exc:  # noqa: BLE001
            await self._record_attempt(
                notification_id,
                attempt_number,
                "events-service",
                "failure",
                {"chatId": chat_id},
                str(exc),
            )
            raise

    async def _record_attempt(
        self,
        notification_id: UUID,
        attempt_number: int,
        channel: str,
        status: str,
        metadata: dict[str, Any],
        error: str | None = None,
    ) -> None:
        await self.attempts.create(
            {
                "notification_id": notification_id,
                "attempt_number": attempt_number,
                "channel": channel,
                "status": status,
                "delivery_metadata": metadata,
                "error": error,
            }
        )
        update_payload: dict[str, Any] = {
            "attempts_count": attempt_number,
            "last_attempt_at": datetime.now(timezone.utc),
        }
        if status == "failure":
            update_payload["last_error"] = error
        else:
            update_payload["last_error"] = None
        await self.repository.update(notification_id, update_payload)

    async def _execute_with_retry(
        self,
        channel: str,
        operation: callable,
    ) -> None:
        attempt = 0
        last_error: Exception | None = None
        while attempt < self.retry_attempts:
            attempt += 1
            try:
                await operation()
                return
            except Exception as exc:  # noqa: BLE001
                last_error = exc if isinstance(exc, Exception) else Exception(str(exc))
                if attempt >= self.retry_attempts:
                    break
                delay = max(self.retry_delay_ms, 0) / 1000.0
                if delay:
                    await asyncio.sleep(delay)
                self.logger.warning(
                    "Channel %s attempt %s failed: %s", channel, attempt, exc
                )
        if last_error is None:
            last_error = NotificationDispatchError("operation_failed")
        raise last_error
