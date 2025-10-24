from __future__ import annotations

import re
from datetime import datetime, date
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import (
    BaseModel,
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


class ClientRead(ORMModel, ClientBase):
    id: UUID
    tenant_id: UUID
    owner_id: UUID | None
    created_at: datetime
    updated_at: datetime


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
    "qualification": "draft",
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
    tenant_id: UUID
    client_id: UUID
    owner_id: UUID | None
    created_at: datetime
    updated_at: datetime

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


class PolicyRead(ORMModel, PolicyBase):
    id: UUID
    tenant_id: UUID
    client_id: UUID
    deal_id: Optional[UUID]
    calculation_id: Optional[UUID]
    owner_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime


class PolicyDocumentLink(BaseModel):
    document_id: UUID


class PolicyDocumentRead(ORMModel):
    id: UUID
    tenant_id: UUID
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
    tenant_id: UUID
    deal_id: UUID
    owner_id: Optional[UUID]
    status: CalculationStatus
    linked_policy_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class CalculationStatusChange(BaseModel):
    status: Literal["ready", "confirmed", "archived"]
    policy_id: Optional[UUID] = None


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    status: str = Field(default="open")
    priority: str = Field(default="normal")
    due_date: Optional[date] = None

    @field_validator("due_date", mode="before")
    @classmethod
    def _convert_datetime_to_date(cls, value: date | datetime | None) -> date | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.date()
        return value


class TaskCreate(TaskBase):
    owner_id: UUID
    deal_id: Optional[UUID] = None
    client_id: Optional[UUID] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[date] = None


class TaskRead(ORMModel, TaskBase):
    id: UUID
    tenant_id: UUID
    owner_id: Optional[UUID]
    deal_id: Optional[UUID]
    client_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime


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
    tenant_id: UUID | None = None
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
