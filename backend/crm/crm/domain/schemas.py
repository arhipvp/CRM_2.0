from __future__ import annotations

from datetime import datetime, date
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator
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


class PaymentEvent(BaseModel):
    tenant_id: UUID
    event_id: UUID
    payment_id: UUID
    deal_id: Optional[UUID]
    policy_id: Optional[UUID]
    status: str
    occurred_at: datetime
    amount: Optional[float] = None
    currency: Optional[str] = None
    payload: dict = Field(default_factory=dict)


class PaymentEventResult(BaseModel):
    processed: bool
    reason: Optional[str] = None


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
