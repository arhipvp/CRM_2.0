from __future__ import annotations

from datetime import datetime, date
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, field_serializer, model_validator
from pydantic_core import PydanticUndefined


class ORMModel(BaseModel):
    model_config = {"from_attributes": True}


class ClientBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    status: str = Field(default="active")


class ClientCreate(ClientBase):
    owner_id: UUID


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None


class ClientRead(ORMModel, ClientBase):
    id: UUID
    tenant_id: UUID
    owner_id: UUID
    created_at: datetime
    updated_at: datetime


class DealBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    status: str = Field(default="draft")
    value: Optional[float] = None
    next_review_at: date


class DealCreate(DealBase):
    client_id: UUID
    owner_id: UUID


class DealUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    value: Optional[float] = None
    next_review_at: Optional[date] = Field(default=PydanticUndefined)

    @field_validator("next_review_at", mode="before")
    @classmethod
    def _validate_next_review_at(cls, value: Optional[date]):
        if value is PydanticUndefined:
            return value
        if value is None:
            raise ValueError("next_review_at cannot be null")
        return value


class DealRead(ORMModel, DealBase):
    id: UUID
    tenant_id: UUID
    client_id: UUID
    owner_id: UUID
    created_at: datetime
    updated_at: datetime


class PolicyBase(BaseModel):
    policy_number: str = Field(min_length=1, max_length=64)
    status: str = Field(default="draft")
    premium: Optional[float] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None


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
    owner_id: UUID
    created_at: datetime
    updated_at: datetime


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    status: str = Field(default="open")
    priority: str = Field(default="normal")
    due_date: Optional[date] = None


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
    owner_id: UUID
    deal_id: Optional[UUID]
    client_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime


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
