from __future__ import annotations

from datetime import datetime, date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


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


class DealCreate(DealBase):
    client_id: UUID
    owner_id: UUID


class DealUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    value: Optional[float] = None


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
