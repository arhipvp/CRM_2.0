from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BaseAPIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    deleted_at: Optional[datetime] = Field(default=None, alias="deletedAt")
    is_deleted: bool = Field(default=False, alias="isDeleted")


class Client(BaseAPIModel):
    id: UUID
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    owner_id: Optional[UUID] = Field(default=None, alias="ownerId")
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, alias="updatedAt")


class Deal(BaseAPIModel):
    id: UUID
    title: str
    description: Optional[str] = None
    status: Optional[str] = None
    stage: Optional[str] = None
    next_review_at: Optional[date] = Field(default=None, alias="nextReviewAt")
    client_id: Optional[UUID] = Field(default=None, alias="clientId")
    owner_id: Optional[UUID] = Field(default=None, alias="ownerId")
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, alias="updatedAt")


class Policy(BaseAPIModel):
    id: UUID
    policy_number: str = Field(alias="policyNumber")
    status: Optional[str] = None
    premium: Optional[float] = None
    effective_from: Optional[date] = Field(default=None, alias="effectiveFrom")
    effective_to: Optional[date] = Field(default=None, alias="effectiveTo")
    client_id: Optional[UUID] = Field(default=None, alias="clientId")
    deal_id: Optional[UUID] = Field(default=None, alias="dealId")
    owner_id: Optional[UUID] = Field(default=None, alias="ownerId")
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, alias="updatedAt")


class Payment(BaseAPIModel):
    id: UUID
    deal_id: UUID = Field(alias="dealId")
    policy_id: UUID = Field(alias="policyId")
    sequence: int
    status: Optional[str] = None
    planned_date: Optional[date] = Field(default=None, alias="plannedDate")
    actual_date: Optional[date] = Field(default=None, alias="actualDate")
    planned_amount: Optional[float] = Field(default=None, alias="plannedAmount")
    currency: Optional[str] = None
    comment: Optional[str] = None
    incomes_total: Optional[float] = Field(default=None, alias="incomesTotal")
    expenses_total: Optional[float] = Field(default=None, alias="expensesTotal")
    net_total: Optional[float] = Field(default=None, alias="netTotal")


class Task(BaseAPIModel):
    id: UUID
    title: str
    description: Optional[str] = None
    status_code: Optional[str] = Field(default=None, alias="statusCode")
    status_name: Optional[str] = Field(default=None, alias="statusName")
    due_at: Optional[datetime] = Field(default=None, alias="dueAt")
    assignee_id: Optional[UUID] = Field(default=None, alias="assigneeId")
    author_id: Optional[UUID] = Field(default=None, alias="authorId")
    deal_id: Optional[UUID] = Field(default=None, alias="dealId")
    policy_id: Optional[UUID] = Field(default=None, alias="policyId")
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, alias="updatedAt")


class StatCounters(BaseAPIModel):
    clients: int = 0
    deals: int = 0
    policies: int = 0
    tasks: int = 0
