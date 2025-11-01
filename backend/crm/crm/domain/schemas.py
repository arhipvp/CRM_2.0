from __future__ import annotations

import re
from datetime import datetime, date, time, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Literal, Optional, Sequence
from uuid import UUID

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_validator,
    field_serializer,
    model_validator,
)
from pydantic_core import PydanticUndefined


class ORMModel(BaseModel):
    model_config = {"from_attributes": True}


class ClientBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    status: str = Field(default="active")


class ClientCreate(ClientBase):
    owner_id: UUID | None = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    is_deleted: Optional[bool] = None


class ClientRead(ORMModel, ClientBase):
    id: UUID
    owner_id: UUID | None
    created_at: datetime
    updated_at: datetime
    is_deleted: bool


class DealBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    status: str = Field(default="draft")
    next_review_at: date


class DealCreate(DealBase):
    client_id: UUID
    owner_id: UUID | None = None


class DealUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    next_review_at: Optional[date] = Field(default=PydanticUndefined)
    is_deleted: Optional[bool] = None

    @field_validator("next_review_at", mode="before")
    @classmethod
    def _validate_next_review_at(cls, value: Optional[date]):
        if value is PydanticUndefined:
            return value
        if value is None:
            raise ValueError("next_review_at cannot be null")
        return value


DealStage = Literal["qualification", "negotiation", "proposal", "closedWon", "closedLost"]

DealPeriod = Literal["7d", "30d", "90d", "all"]

_STATUS_TO_STAGE: dict[str, DealStage] = {
    "draft": "qualification",
    "qualification": "qualification",
    "in_progress": "negotiation",
    "negotiation": "negotiation",
    "proposal": "proposal",
    "won": "closedWon",
    "closed_won": "closedWon",
    "lost": "closedLost",
    "closed_lost": "closedLost",
}

_STAGE_TO_STATUS: dict[DealStage, str] = {
    "qualification": "qualification",
    "negotiation": "in_progress",
    "proposal": "proposal",
    "closedWon": "won",
    "closedLost": "lost",
}


def _normalize_status(value: str) -> str:
    normalized = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", value)
    normalized = normalized.replace("-", "_")
    normalized = re.sub(r"\s+", "_", normalized)
    normalized = normalized.strip().lower()
    synonyms = {
        "inprogress": "in_progress",
        "closedwon": "closed_won",
        "closedlost": "closed_lost",
    }
    return synonyms.get(normalized, normalized)


def map_deal_status_to_stage(status: str | None) -> DealStage:
    if not status:
        return "qualification"
    normalized = _normalize_status(status)
    return _STATUS_TO_STAGE.get(normalized, "qualification")


def map_stage_to_deal_status(stage: DealStage) -> str:
    return _STAGE_TO_STATUS[stage]


class DealRead(ORMModel, DealBase):
    id: UUID
    client_id: UUID
    owner_id: UUID | None
    created_at: datetime
    updated_at: datetime
    is_deleted: bool

    @computed_field
    @property
    def stage(self) -> DealStage:
        return map_deal_status_to_stage(self.status)


class DealStageUpdate(BaseModel):
    stage: DealStage


class DealFilters(BaseModel):
    stage: DealStage | None = None
    managers: list[UUID] = Field(default_factory=list)
    include_unassigned: bool = False
    period: DealPeriod | None = None
    search: Optional[str] = None


class DealStageMetric(BaseModel):
    stage: DealStage
    count: int
    total_value: Decimal = Field(default=Decimal("0"))
    conversion_rate: float
    avg_cycle_duration_days: float | None

    @field_serializer("total_value")
    def _serialize_total_value(self, value: Decimal) -> float:
        return float(value)


class DealJournalEntryBase(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class DealJournalEntryCreate(DealJournalEntryBase):
    author_id: UUID


class DealJournalEntryRead(ORMModel, DealJournalEntryBase):
    id: UUID
    deal_id: UUID
    author_id: UUID
    created_at: datetime


class DealJournalEntryList(BaseModel):
    items: list[DealJournalEntryRead]
    total: int


class PolicyBase(BaseModel):
    policy_number: str = Field(min_length=1, max_length=64)
    status: str = Field(default="draft")
    premium: Optional[float] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None

    @field_validator("effective_from", "effective_to", mode="before")
    @classmethod
    def _convert_datetime_to_date(cls, value: date | datetime | None) -> date | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.date()
        return value


class PolicyCreate(PolicyBase):
    client_id: UUID
    deal_id: Optional[UUID] = None
    owner_id: UUID


class PolicyUpdate(BaseModel):
    status: Optional[str] = None
    premium: Optional[float] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    is_deleted: Optional[bool] = None


class PolicyRead(ORMModel, PolicyBase):
    id: UUID
    client_id: UUID
    deal_id: Optional[UUID]
    calculation_id: Optional[UUID]
    owner_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    is_deleted: bool


class PolicyDocumentLink(BaseModel):
    document_id: UUID


class PolicyDocumentRead(ORMModel):
    id: UUID
    policy_id: UUID
    document_id: UUID
    created_at: datetime


class DateRange(BaseModel):
    start: Optional[date] = None
    end: Optional[date] = None

    @model_validator(mode="after")
    def _validate_range(self) -> "DateRange":
        if self.start and self.end and self.end < self.start:
            raise ValueError("end_before_start")
        return self


CalculationStatus = Literal["draft", "ready", "confirmed", "archived"]


class CalculationBase(BaseModel):
    insurance_company: str = Field(min_length=1, max_length=255)
    program_name: Optional[str] = Field(default=None, max_length=255)
    premium_amount: Optional[Decimal] = Field(default=None, decimal_places=2, max_digits=14)
    coverage_sum: Optional[Decimal] = Field(default=None, decimal_places=2, max_digits=14)
    calculation_date: date
    validity_period: Optional[DateRange] = None
    files: list[str] = Field(default_factory=list)
    comments: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("premium_amount", "coverage_sum")
    @classmethod
    def _validate_positive_decimal(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        if value is None:
            return value
        if value <= 0:
            raise ValueError("must_be_positive")
        return value


class CalculationCreate(CalculationBase):
    owner_id: UUID


class CalculationUpdate(BaseModel):
    insurance_company: Optional[str] = Field(default=PydanticUndefined, min_length=1, max_length=255)
    program_name: Optional[str] = Field(default=PydanticUndefined, max_length=255)
    premium_amount: Optional[Decimal] = Field(default=PydanticUndefined, decimal_places=2, max_digits=14)
    coverage_sum: Optional[Decimal] = Field(default=PydanticUndefined, decimal_places=2, max_digits=14)
    calculation_date: Optional[date] = Field(default=PydanticUndefined)
    validity_period: Optional[DateRange | None] = Field(default=PydanticUndefined)
    files: Optional[list[str]] = Field(default=PydanticUndefined)
    comments: Optional[str] = Field(default=PydanticUndefined, max_length=2000)

    @field_validator("premium_amount", "coverage_sum")
    @classmethod
    def _validate_positive_decimal(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        if value is None:
            return value
        if value <= 0:
            raise ValueError("must_be_positive")
        return value


class CalculationRead(ORMModel, CalculationBase):
    id: UUID
    deal_id: UUID
    owner_id: Optional[UUID]
    status: CalculationStatus
    linked_policy_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class CalculationStatusChange(BaseModel):
    status: Literal["ready", "confirmed", "archived"]
    policy_id: Optional[UUID] = None


class TaskStatusCode(str, Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


def _to_camel_case(value: str) -> str:
    segments = re.split(r"[_\-\s]+", value.strip())
    if not segments:
        return value
    first, *rest = segments
    return first.lower() + "".join(part.capitalize() for part in rest)


def _extract_string(payload: dict[str, Any], keys: Sequence[str]) -> str | None:
    for key in keys:
        raw = payload.get(key)
        if isinstance(raw, str):
            stripped = raw.strip()
            if stripped:
                return stripped
    return None


def _parse_uuid(value: Any) -> UUID | None:
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        return None


def _normalize_context(context: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in context.items():
        if not isinstance(key, str):
            continue
        camel_key = _to_camel_case(key)
        normalized[camel_key] = value
    return normalized


class TaskCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    subject: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    assignee_id: UUID = Field(validation_alias=AliasChoices("assignee_id", "assigneeId"))
    author_id: UUID = Field(validation_alias=AliasChoices("author_id", "authorId"))
    due_at: datetime | None = Field(
        default=None,
        validation_alias=AliasChoices("due_date", "dueDate", "due_at", "dueAt"),
        serialization_alias="dueAt",
    )
    priority: TaskPriority | None = Field(
        default=None, validation_alias=AliasChoices("priority")
    )
    context: dict[str, Any] | None = Field(default=None)
    payload: dict[str, Any] | None = Field(default=None)
    scheduled_for: datetime | None = Field(
        default=None,
        validation_alias=AliasChoices("scheduled_for", "scheduledFor"),
        serialization_alias="scheduledFor",
    )
    initial_status: TaskStatusCode = Field(
        default=TaskStatusCode.PENDING,
        validation_alias=AliasChoices("initial_status", "initialStatus"),
        serialization_alias="initialStatus",
    )

    @field_validator("subject", "description")
    @classmethod
    def _strip_required(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must_not_be_blank")
        return stripped

    @field_validator("due_at", "scheduled_for", mode="before")
    @classmethod
    def _ensure_datetime(cls, value: Any) -> Any:
        if value is None or value is PydanticUndefined:
            return None if value is None else PydanticUndefined
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, date):
            return datetime.combine(value, time.min, tzinfo=timezone.utc)
        return value


class TaskUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: TaskStatusCode | None = Field(
        default=None, validation_alias=AliasChoices("status", "statusCode")
    )
    due_at: datetime | None = Field(
        default=PydanticUndefined,
        validation_alias=AliasChoices("due_date", "dueDate", "due_at", "dueAt"),
        serialization_alias="dueAt",
    )
    scheduled_for: datetime | None = Field(
        default=PydanticUndefined,
        validation_alias=AliasChoices("scheduled_for", "scheduledFor"),
        serialization_alias="scheduledFor",
    )
    completed_at: datetime | None = Field(
        default=PydanticUndefined,
        validation_alias=AliasChoices("completed_at", "completedAt"),
        serialization_alias="completedAt",
    )
    cancelled_reason: str | None = Field(
        default=PydanticUndefined,
        validation_alias=AliasChoices("cancelled_reason", "cancelledReason"),
        serialization_alias="cancelledReason",
        max_length=5000,
    )

    @field_validator("due_at", "scheduled_for", "completed_at", mode="before")
    @classmethod
    def _ensure_optional_datetime(cls, value: Any) -> Any:
        if value is PydanticUndefined:
            return value
        if value is None:
            return None
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, date):
            return datetime.combine(value, time.min, tzinfo=timezone.utc)
        return value

    @field_validator("cancelled_reason", mode="before")
    @classmethod
    def _strip_cancelled_reason(cls, value: Any) -> Any:
        if value is PydanticUndefined or value is None:
            return value
        if isinstance(value, str):
            return value.strip()
        return value


class TaskScheduleRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    scheduled_for: datetime = Field(
        validation_alias=AliasChoices("scheduled_for", "scheduledFor"),
        serialization_alias="scheduledFor",
    )

    @field_validator("scheduled_for", mode="before")
    @classmethod
    def _ensure_scheduled_datetime(cls, value: Any) -> Any:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, date):
            return datetime.combine(value, time.min, tzinfo=timezone.utc)
        return value


class TaskCompleteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    completed_at: datetime | None = Field(
        default=None,
        validation_alias=AliasChoices("completed_at", "completedAt"),
        serialization_alias="completedAt",
    )

    @field_validator("completed_at", mode="before")
    @classmethod
    def _ensure_completed_datetime(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, date):
            return datetime.combine(value, time.min, tzinfo=timezone.utc)
        return value


class TaskFilters(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    assignee_id: UUID | None = Field(default=None)
    statuses: list[TaskStatusCode] = Field(default_factory=list)
    due_before: date | None = Field(default=None)
    due_after: date | None = Field(default=None)
    priorities: list[TaskPriority] = Field(default_factory=list)
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)

    @field_validator("statuses", "priorities", mode="before")
    @classmethod
    def _ensure_list(cls, value: Any) -> list[Any]:
        if value is None or value is PydanticUndefined:
            return []
        if isinstance(value, (list, tuple, set)):
            return list(value)
        return [value]

    @field_validator("due_before", "due_after", mode="before")
    @classmethod
    def _ensure_date(cls, value: Any) -> Any:
        if value is None or value is PydanticUndefined:
            return None
        if isinstance(value, datetime):
            return value.date()
        return value


class TaskReminderChannel(str, Enum):
    SSE = "sse"
    TELEGRAM = "telegram"


class TaskReminderCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    remind_at: datetime = Field(
        validation_alias=AliasChoices("remind_at", "remindAt"),
        serialization_alias="remindAt",
    )
    channel: TaskReminderChannel = Field(
        default=TaskReminderChannel.SSE, validation_alias=AliasChoices("channel")
    )

    @field_validator("remind_at", mode="before")
    @classmethod
    def _ensure_remind_datetime(cls, value: Any) -> Any:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, date):
            return datetime.combine(value, time.min, tzinfo=timezone.utc)
        return value


class TaskRead(ORMModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    title: str
    description: str | None = None
    status_code: TaskStatusCode = Field(serialization_alias="statusCode")
    status_name: str | None = Field(default=None, serialization_alias="statusName")
    due_at: datetime | None = Field(default=None, serialization_alias="dueAt")
    scheduled_for: datetime | None = Field(
        default=None, serialization_alias="scheduledFor"
    )
    completed_at: datetime | None = Field(
        default=None, serialization_alias="completedAt"
    )
    cancelled_reason: str | None = Field(
        default=None, serialization_alias="cancelledReason"
    )
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")
    payload: dict[str, Any] | None = None
    assignee_id: UUID | None = Field(default=None, serialization_alias="assigneeId")
    author_id: UUID | None = Field(default=None, serialization_alias="authorId")
    priority: TaskPriority | None = Field(
        default=None, serialization_alias="priority"
    )
    deal_id: UUID | None = Field(default=None, serialization_alias="dealId")
    policy_id: UUID | None = Field(default=None, serialization_alias="policyId")
    payment_id: UUID | None = Field(default=None, serialization_alias="paymentId")
    client_id: UUID | None = Field(default=None, serialization_alias="clientId")
    context: dict[str, Any] | None = Field(default=None, serialization_alias="context")

    @model_validator(mode="before")
    @classmethod
    def _prepare(cls, value: Any):
        if isinstance(value, dict):
            return value
        data = {
            "id": getattr(value, "id", None),
            "title": getattr(value, "title", None),
            "description": getattr(value, "description", None),
            "status_code": getattr(value, "status_code", None),
            "status_name": getattr(getattr(value, "status", None), "name", None),
            "due_at": getattr(value, "due_at", None),
            "scheduled_for": getattr(value, "scheduled_for", None),
            "completed_at": getattr(value, "completed_at", None),
            "cancelled_reason": getattr(value, "cancelled_reason", None),
            "created_at": getattr(value, "created_at", None),
            "updated_at": getattr(value, "updated_at", None),
            "payload": getattr(value, "payload", None),
            "assignee_id": getattr(value, "assignee_id", None),
            "author_id": getattr(value, "author_id", None),
            "deal_id": getattr(value, "deal_id", None),
            "policy_id": getattr(value, "policy_id", None),
            "payment_id": getattr(value, "payment_id", None),
        }
        return data

    @model_validator(mode="after")
    def _post_process(self) -> "TaskRead":
        payload = self.payload or {}

        if self.assignee_id is None:
            assignee = _extract_string(payload, ["assigneeId", "assignee_id"])
            if assignee:
                parsed = _parse_uuid(assignee)
                if parsed:
                    self.assignee_id = parsed

        if self.author_id is None:
            author = _extract_string(payload, ["authorId", "author_id"])
            if author:
                parsed_author = _parse_uuid(author)
                if parsed_author:
                    self.author_id = parsed_author
        author_value = _extract_string(payload, ["authorId", "author_id"])
        if author_value and "payload" in self.model_fields:
            payload.setdefault("authorId", author_value)

        priority_value = _extract_string(payload, ["priority"])
        if priority_value:
            try:
                self.priority = TaskPriority(priority_value)
            except ValueError:
                self.priority = None

        if self.deal_id is None:
            deal = _extract_string(payload, ["dealId", "deal_id"])
            if deal:
                parsed_deal = _parse_uuid(deal)
                if parsed_deal:
                    self.deal_id = parsed_deal

        if self.policy_id is None:
            policy = _extract_string(payload, ["policyId", "policy_id"])
            if policy:
                parsed_policy = _parse_uuid(policy)
                if parsed_policy:
                    self.policy_id = parsed_policy

        if self.payment_id is None:
            payment = _extract_string(payload, ["paymentId", "payment_id"])
            if payment:
                parsed_payment = _parse_uuid(payment)
                if parsed_payment:
                    self.payment_id = parsed_payment

        client = _extract_string(payload, ["clientId", "client_id"])
        if client:
            parsed_client = _parse_uuid(client)
            if parsed_client:
                self.client_id = parsed_client

        context_value = payload.get("context")
        if isinstance(context_value, dict):
            normalized_context = _normalize_context(context_value)
            self.context = normalized_context or None

        return self


class TaskReminderRead(ORMModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    task_id: UUID = Field(serialization_alias="taskId")
    remind_at: datetime = Field(serialization_alias="remindAt")
    channel: TaskReminderChannel
    created_at: datetime = Field(serialization_alias="createdAt")


def _normalize_currency(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return value
    normalized = value.strip()
    if not normalized:
        raise ValueError("currency cannot be blank")
    return normalized.upper()


class PaymentBase(BaseModel):
    planned_date: Optional[date] = None
    planned_amount: Decimal = Field(decimal_places=2, max_digits=14)
    currency: str = Field(min_length=1, max_length=12)
    comment: Optional[str] = Field(default=None, max_length=500)
    actual_date: Optional[date] = None
    recorded_by_id: Optional[UUID] = None

    @field_validator("planned_amount")
    @classmethod
    def validate_planned_amount(cls, value: Decimal) -> Decimal:
        if value <= 0:
            raise ValueError("planned_amount must be greater than zero")
        return value

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        normalized = _normalize_currency(value)
        if normalized is None:
            raise ValueError("currency is required")
        return normalized

    @field_serializer("planned_amount", when_used="json")
    def serialize_planned_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"


class PaymentCreate(PaymentBase):
    created_by_id: Optional[UUID] = None


class PaymentUpdate(BaseModel):
    planned_date: Optional[date] = None
    planned_amount: Optional[Decimal] = Field(default=None, decimal_places=2, max_digits=14)
    currency: Optional[str] = Field(default=None, min_length=1, max_length=12)
    comment: Optional[str] = Field(default=None, max_length=500)
    actual_date: Optional[date] = None
    status: Optional[str] = None
    recorded_by_id: Optional[UUID] = None

    @field_validator("planned_amount")
    @classmethod
    def validate_update_amount(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        if value is None:
            return value
        if value <= 0:
            raise ValueError("planned_amount must be greater than zero")
        return value

    @field_serializer("planned_amount", when_used="json")
    def serialize_update_amount(self, value: Optional[Decimal]) -> Optional[str]:
        if value is None:
            return None
        return f"{value:.2f}"

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_update_currency(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_currency(value)


class PaymentIncomeBase(BaseModel):
    amount: Decimal = Field(decimal_places=2, max_digits=14)
    currency: str = Field(min_length=1, max_length=12)
    category: str = Field(min_length=1, max_length=64)
    posted_at: date
    note: Optional[str] = Field(default=None, max_length=300)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: Decimal) -> Decimal:
        if value <= 0:
            raise ValueError("amount must be greater than zero")
        return value

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        normalized = _normalize_currency(value)
        if normalized is None:
            raise ValueError("currency is required")
        return normalized

    @field_serializer("amount", when_used="json")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"


class PaymentIncomeCreate(PaymentIncomeBase):
    created_by_id: Optional[UUID] = None


class PaymentIncomeUpdate(BaseModel):
    amount: Optional[Decimal] = Field(default=None, decimal_places=2, max_digits=14)
    currency: Optional[str] = Field(default=None, min_length=1, max_length=12)
    category: Optional[str] = Field(default=None, min_length=1, max_length=64)
    posted_at: Optional[date] = None
    note: Optional[str] = Field(default=None, max_length=300)
    updated_by_id: Optional[UUID] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        if value is None:
            return value
        if value <= 0:
            raise ValueError("amount must be greater than zero")
        return value

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_update_currency(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_currency(value)

    @field_serializer("amount", when_used="json")
    def serialize_amount(self, value: Optional[Decimal]) -> Optional[str]:
        if value is None:
            return None
        return f"{value:.2f}"


class PaymentExpenseBase(PaymentIncomeBase):
    pass


class PaymentExpenseCreate(PaymentExpenseBase):
    created_by_id: Optional[UUID] = None


class PaymentExpenseUpdate(PaymentIncomeUpdate):
    pass


class PaymentIncomeRead(ORMModel, PaymentIncomeBase):
    id: UUID
    payment_id: UUID
    created_by_id: Optional[UUID] = None
    updated_by_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class PaymentExpenseRead(ORMModel, PaymentExpenseBase):
    id: UUID
    payment_id: UUID
    created_by_id: Optional[UUID] = None
    updated_by_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class PaymentRead(ORMModel, PaymentBase):
    id: UUID
    deal_id: UUID
    policy_id: UUID
    sequence: int
    status: str
    created_by_id: Optional[UUID] = None
    updated_by_id: Optional[UUID] = None
    incomes_total: Decimal = Field(decimal_places=2, max_digits=14)
    expenses_total: Decimal = Field(decimal_places=2, max_digits=14)
    net_total: Decimal = Field(decimal_places=2, max_digits=14)
    created_at: datetime
    updated_at: datetime
    incomes: list[PaymentIncomeRead] = Field(default_factory=list)
    expenses: list[PaymentExpenseRead] = Field(default_factory=list)

    @field_serializer("incomes_total", "expenses_total", "net_total", when_used="json")
    def serialize_totals(self, value: Decimal) -> str:
        return f"{value:.2f}"


class PaymentList(BaseModel):
    items: list[PaymentRead]
    total: int


class SyncPermissionsUser(BaseModel):
    user_id: UUID
    role: Literal["viewer", "editor"]


class SyncPermissionsDto(BaseModel):
    owner_type: str = Field(min_length=1, max_length=64)
    owner_id: UUID
    users: list[SyncPermissionsUser]

    @model_validator(mode="after")
    def validate_users(self) -> "SyncPermissionsDto":
        if not self.users:
            raise ValueError("users must not be empty")
        ids = [user.user_id for user in self.users]
        if len(ids) != len(set(ids)):
            raise ValueError("users must be unique")
        return self


class SyncPermissionsResponse(BaseModel):
    job_id: UUID
    status: str


class NotificationTemplateChannel(str, Enum):
    SSE = "sse"
    TELEGRAM = "telegram"


class NotificationTemplateStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class NotificationTemplateBase(BaseModel):
    key: str = Field(min_length=1, max_length=255)
    channel: NotificationTemplateChannel
    body: str = Field(min_length=1)
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("metadata", "template_metadata"),
    )
    status: NotificationTemplateStatus = Field(default=NotificationTemplateStatus.ACTIVE)


class NotificationTemplateCreate(NotificationTemplateBase):
    locale: str | None = Field(default=None, min_length=2, max_length=16)


class NotificationTemplateRead(ORMModel, NotificationTemplateBase):
    id: UUID
    locale: str
    created_at: datetime
    updated_at: datetime


class NotificationTemplateListFilters(BaseModel):
    channel: NotificationTemplateChannel | None = None
    active: bool | None = None


class NotificationRecipient(BaseModel):
    user_id: str = Field(min_length=1, max_length=255, serialization_alias="userId")
    telegram_id: str | None = Field(default=None, max_length=255, serialization_alias="telegramId")

    model_config = ConfigDict(populate_by_name=True)


class NotificationStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSED = "processed"
    FAILED = "failed"


class NotificationCreate(BaseModel):
    event_key: str = Field(min_length=1, max_length=255, serialization_alias="eventKey")
    recipients: list[NotificationRecipient]
    payload: dict[str, Any]
    channel_overrides: list[str] | None = Field(default=None, serialization_alias="channelOverrides")
    deduplication_key: str | None = Field(default=None, max_length=255, serialization_alias="deduplicationKey")

    model_config = ConfigDict(populate_by_name=True)


class NotificationAttemptRead(ORMModel):
    id: UUID
    notification_id: UUID
    attempt_number: int
    channel: str
    status: str
    metadata: dict[str, Any] | None = Field(
        default=None,
        validation_alias=AliasChoices("delivery_metadata", "metadata"),
        serialization_alias="metadata",
    )
    error: str | None
    created_at: datetime


class NotificationRead(ORMModel):
    id: UUID
    event_key: str
    payload: dict[str, Any]
    recipients: list[NotificationRecipient]
    channel_overrides: list[str] | None
    deduplication_key: str | None
    status: NotificationStatus
    attempts_count: int
    last_attempt_at: datetime | None
    last_error: str | None
    created_at: datetime
    updated_at: datetime
    attempts: list[NotificationAttemptRead] = Field(default_factory=list)


class NotificationStatusResponse(BaseModel):
    id: UUID
    status: str
    attempts: int
    channels: list[str]
    delivered_at: datetime | None = Field(default=None, alias="delivered_at")

    model_config = ConfigDict(populate_by_name=True)


class NotificationEvent(BaseModel):
    id: UUID
    event_type: str
    payload: dict[str, Any]
    delivered_to_telegram: bool
    telegram_message_id: str | None
    telegram_delivery_status: str | None
    telegram_delivery_reason: str | None
    telegram_delivery_occurred_at: datetime | None
    created_at: datetime
    updated_at: datetime


class NotificationEventIngest(BaseModel):
    id: UUID
    source: str
    type: str
    time: datetime
    data: dict[str, Any]
    chat_id: str | None = Field(default=None, serialization_alias="chatId")

    model_config = ConfigDict(populate_by_name=True)


class TelegramDeliveryWebhookStatus(str, Enum):
    DELIVERED = "delivered"
    FAILED = "failed"


class TelegramDeliveryWebhook(BaseModel):
    message_id: str = Field(min_length=1, serialization_alias="messageId")
    status: TelegramDeliveryWebhookStatus
    reason: str | None = None
    occurred_at: datetime = Field(serialization_alias="occurredAt")

    model_config = ConfigDict(populate_by_name=True)
