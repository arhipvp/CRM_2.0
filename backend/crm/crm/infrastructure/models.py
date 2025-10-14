from __future__ import annotations

from datetime import datetime, date
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.schema import MetaData


class CRMBase(DeclarativeBase):
    metadata = MetaData(schema="crm")


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class OwnershipMixin:
    tenant_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    owner_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Client(CRMBase, TimestampMixin, OwnershipMixin):
    __tablename__ = "clients"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")

    deals: Mapped[list["Deal"]] = relationship(back_populates="client", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_clients_status", "status"),)


class Deal(CRMBase, TimestampMixin, OwnershipMixin):
    __tablename__ = "deals"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id: Mapped[UUID] = mapped_column(ForeignKey("crm.clients.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    value: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    next_review_at: Mapped[date] = mapped_column(
        Date, nullable=False, server_default=func.current_date()
    )

    client: Mapped[Client] = relationship(back_populates="deals")
    policies: Mapped[list["Policy"]] = relationship(back_populates="deal", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_deals_status", "status"),
        Index("ix_deals_next_review_at", "next_review_at"),
    )


class Policy(CRMBase, TimestampMixin, OwnershipMixin):
    __tablename__ = "policies"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id: Mapped[UUID] = mapped_column(ForeignKey("crm.clients.id", ondelete="RESTRICT"), nullable=False)
    deal_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("crm.deals.id", ondelete="SET NULL"), nullable=True
    )
    policy_number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    premium: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    client: Mapped[Client] = relationship()
    deal: Mapped[Deal | None] = relationship(back_populates="policies")

    __table_args__ = (
        Index("ix_policies_status", "status"),
        Index("ix_policies_client", "client_id"),
    )


class Task(CRMBase, TimestampMixin, OwnershipMixin):
    __tablename__ = "tasks"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    deal_id: Mapped[UUID | None] = mapped_column(ForeignKey("crm.deals.id", ondelete="SET NULL"), nullable=True)
    client_id: Mapped[UUID | None] = mapped_column(ForeignKey("crm.clients.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="open")
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    __table_args__ = (
        Index("ix_tasks_status", "status"),
        Index("ix_tasks_due_date", "due_date"),
    )


class PaymentSyncLog(CRMBase, TimestampMixin, OwnershipMixin):
    __tablename__ = "payment_sync_log"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True)
    payment_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    deal_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    policy_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(12), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    __table_args__ = (
        Index("ix_payment_sync_log_status", "status"),
        Index("ix_payment_sync_log_payment", "payment_id"),
    )


class PermissionSyncJob(CRMBase, TimestampMixin):
    __tablename__ = "permission_sync_jobs"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    owner_type: Mapped[str] = mapped_column(String(64), nullable=False)
    owner_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    queue_name: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    users: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_permission_sync_jobs_tenant", "tenant_id"),
        Index("ix_permission_sync_jobs_status", "status"),
        Index("ix_permission_sync_jobs_owner", "owner_id"),
        Index("ix_permission_sync_jobs_owner_type", "owner_type"),
    )
