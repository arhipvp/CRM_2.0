from __future__ import annotations

from datetime import datetime, date
from decimal import Decimal
from uuid import uuid4

from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    Integer,
    JSON,
)
from sqlalchemy.dialects.postgresql import ARRAY, DATERANGE, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.schema import MetaData

try:  # pragma: no cover - optional dependency guard for typing
    from asyncpg.pgproto.pgproto import Range as PgRange
except (ModuleNotFoundError, ImportError):  # pragma: no cover - fallback for type checking
    from typing import Any as PgRange  # type: ignore[assignment]


class CRMBase(DeclarativeBase):
    metadata = MetaData(schema="crm")


class TasksBase(DeclarativeBase):
    metadata = MetaData(schema="tasks")


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class OwnershipMixin:
    owner_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Client(CRMBase, TimestampMixin, OwnershipMixin):
    __tablename__ = "clients"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")

    deals: Mapped[list["Deal"]] = relationship(back_populates="client", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_clients_status", "status"),)


class Deal(CRMBase, TimestampMixin, OwnershipMixin):
    __tablename__ = "deals"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    client_id: Mapped[UUID] = mapped_column(ForeignKey("crm.clients.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    next_review_at: Mapped[date] = mapped_column(
        Date, nullable=False, server_default=func.current_date()
    )

    client: Mapped[Client] = relationship(back_populates="deals")
    policies: Mapped[list["Policy"]] = relationship(back_populates="deal", cascade="all, delete-orphan")
    calculations: Mapped[list["Calculation"]] = relationship(
        back_populates="deal", cascade="all, delete-orphan"
    )
    journal_entries: Mapped[list["DealJournalEntry"]] = relationship(
        back_populates="deal",
        cascade="all, delete-orphan",
        order_by="DealJournalEntry.created_at.asc()",
    )

    __table_args__ = (
        Index("ix_deals_status", "status"),
        Index("ix_deals_next_review_at", "next_review_at"),
    )


class DealJournalEntry(CRMBase):
    __tablename__ = "deal_journal"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    deal_id: Mapped[UUID] = mapped_column(ForeignKey("crm.deals.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    deal: Mapped[Deal] = relationship(back_populates="journal_entries")

    __table_args__ = (
        Index("ix_deal_journal_deal_id", "deal_id"),
        Index("ix_deal_journal_created_at", "created_at"),
    )


class Policy(CRMBase, TimestampMixin, OwnershipMixin):
    __tablename__ = "policies"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id: Mapped[UUID] = mapped_column(ForeignKey("crm.clients.id", ondelete="RESTRICT"), nullable=False)
    deal_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("crm.deals.id", ondelete="SET NULL"), nullable=True
    )
    calculation_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("crm.calculations.id", ondelete="SET NULL"), nullable=True
    )
    policy_number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    premium: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    client: Mapped[Client] = relationship()
    deal: Mapped[Deal | None] = relationship(back_populates="policies")
    calculation: Mapped["Calculation | None"] = relationship(back_populates="policy")
    documents: Mapped[list["PolicyDocument"]] = relationship(
        back_populates="policy",
        cascade="all, delete-orphan",
        order_by="PolicyDocument.created_at.asc()",
    )

    __table_args__ = (
        Index("ix_policies_status", "status"),
        Index("ix_policies_client", "client_id"),
        Index("ix_policies_calculation_id", "calculation_id"),
    )


class Calculation(CRMBase, TimestampMixin, OwnershipMixin):
    __tablename__ = "calculations"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    deal_id: Mapped[UUID] = mapped_column(ForeignKey("crm.deals.id", ondelete="RESTRICT"), nullable=False)
    insurance_company: Mapped[str] = mapped_column(String(255), nullable=False)
    program_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    premium_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    coverage_sum: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    calculation_date: Mapped[date] = mapped_column(Date, nullable=False)
    validity_period: Mapped[PgRange | None] = mapped_column(DATERANGE, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    files: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)

    deal: Mapped[Deal] = relationship(back_populates="calculations")
    policy: Mapped["Policy | None"] = relationship(back_populates="calculation", uselist=False)

    __table_args__ = (
        Index("ix_calculations_status", "status"),
        Index("ix_calculations_calculation_date", "calculation_date"),
        Index("ix_calculations_insurance_company", "insurance_company"),
    )


class TaskStatus(TasksBase):
    __tablename__ = "task_statuses"

    code: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_final: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=func.false())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    tasks: Mapped[list["Task"]] = relationship(back_populates="status")


class Task(TasksBase, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status_code: Mapped[str] = mapped_column(
        String(32), ForeignKey("tasks.task_statuses.code", onupdate="CASCADE"), nullable=False
    )
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payload: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    assignee_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    author_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    deal_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crm.deals.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    policy_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crm.policies.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    payment_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crm.payments.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[TaskStatus] = relationship(back_populates="tasks")
    reminders: Mapped[list["TaskReminder"]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskReminder.remind_at.asc()",
    )
    activities: Mapped[list["TaskActivity"]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskActivity.created_at.asc()",
    )

    __table_args__ = (
        Index("ix_tasks_status_code", "status_code"),
        Index("ix_tasks_status_code_due_at", "status_code", "due_at"),
        Index("ix_tasks_assignee_id", "assignee_id"),
        Index("ix_tasks_deal_id", "deal_id"),
    )


class TaskReminder(TasksBase):
    __tablename__ = "task_reminders"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id: Mapped[UUID] = mapped_column(
        ForeignKey("tasks.tasks.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False
    )
    remind_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    task: Mapped[Task] = relationship(back_populates="reminders")

    __table_args__ = (
        Index("ix_task_reminders_due", "remind_at"),
        Index(
            "idx_task_reminders_unique",
            "task_id",
            "remind_at",
            "channel",
            unique=True,
        ),
    )


class TaskActivity(TasksBase):
    __tablename__ = "task_activity"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id: Mapped[UUID] = mapped_column(
        ForeignKey("tasks.tasks.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False
    )
    author_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    task: Mapped[Task] = relationship(back_populates="activities")

    __table_args__ = (Index("ix_task_activity_created_at", "created_at"),)


Index(
    "ix_tasks_scheduled_for",
    Task.scheduled_for,
    postgresql_where=Task.scheduled_for.isnot(None),
)

Index(
    "ix_tasks_due_at",
    Task.due_at,
    postgresql_where=Task.due_at.isnot(None),
)


class Payment(CRMBase, TimestampMixin):
    __tablename__ = "payments"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    deal_id: Mapped[UUID] = mapped_column(
        ForeignKey("crm.deals.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    policy_id: Mapped[UUID] = mapped_column(
        ForeignKey("crm.policies.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="scheduled")
    planned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(12), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_by_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_by_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    incomes_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    expenses_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    net_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    incomes: Mapped[list["PaymentIncome"]] = relationship(
        back_populates="payment",
        cascade="all, delete-orphan",
        order_by="PaymentIncome.posted_at",
    )
    expenses: Mapped[list["PaymentExpense"]] = relationship(
        back_populates="payment",
        cascade="all, delete-orphan",
        order_by="PaymentExpense.posted_at",
    )

    __table_args__ = (
        Index("ux_payments_policy_sequence", "policy_id", "sequence", unique=True),
        Index("ix_payments_status", "status"),
    )


class PaymentIncome(CRMBase, TimestampMixin):
    __tablename__ = "payment_incomes"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    payment_id: Mapped[UUID] = mapped_column(
        ForeignKey("crm.payments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(12), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    posted_at: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_by_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    payment: Mapped[Payment] = relationship(back_populates="incomes")


class PaymentExpense(CRMBase, TimestampMixin):
    __tablename__ = "payment_expenses"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    payment_id: Mapped[UUID] = mapped_column(
        ForeignKey("crm.payments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(12), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    posted_at: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_by_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    payment: Mapped[Payment] = relationship(back_populates="expenses")


class PolicyDocument(CRMBase):
    __tablename__ = "policy_documents"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    policy_id: Mapped[UUID] = mapped_column(
        ForeignKey("crm.policies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    policy: Mapped[Policy] = relationship(back_populates="documents")

    __table_args__ = (
        UniqueConstraint("policy_id", "document_id", name="ux_policy_documents_policy_document"),
    )


class PermissionSyncJob(CRMBase, TimestampMixin):
    __tablename__ = "permission_sync_jobs"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_type: Mapped[str] = mapped_column(String(64), nullable=False)
    owner_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    queue_name: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    users: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_permission_sync_jobs_status", "status"),
        Index("ix_permission_sync_jobs_owner", "owner_id"),
        Index("ix_permission_sync_jobs_owner_type", "owner_type"),
    )


class NotificationTemplate(CRMBase, TimestampMixin):
    __tablename__ = "notification_templates"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    locale: Mapped[str] = mapped_column(String(16), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    template_metadata: Mapped[dict[str, object]] = mapped_column(
        "metadata", JSONB, default=dict, nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    __table_args__ = (
        UniqueConstraint("key", "channel", name="uq_notification_templates_key_channel"),
        Index("ix_notification_templates_channel", "channel"),
        Index("ix_notification_templates_status", "status"),
        Index("ix_notification_templates_locale", "locale"),
    )


class Notification(CRMBase, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    event_key: Mapped[str] = mapped_column(String(255), nullable=False)
    payload: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    recipients: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False)
    channel_overrides: Mapped[list[str] | None] = mapped_column(ARRAY(String(64)), nullable=True)
    deduplication_key: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    attempts_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    attempts: Mapped[list["NotificationDeliveryAttempt"]] = relationship(
        back_populates="notification",
        cascade="all, delete-orphan",
        order_by="NotificationDeliveryAttempt.attempt_number.asc()",
    )

    __table_args__ = (
        Index("ix_notifications_event_key", "event_key"),
        Index("ix_notifications_status", "status"),
    )


class NotificationDeliveryAttempt(CRMBase):
    __tablename__ = "notification_delivery_attempts"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    notification_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm.notifications.id", ondelete="CASCADE"), nullable=False
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    channel: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    delivery_metadata: Mapped[dict[str, object] | None] = mapped_column(
        "metadata", JSONB, nullable=True
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    notification: Mapped[Notification] = relationship(back_populates="attempts")

    __table_args__ = (
        Index("ix_notification_delivery_attempts_notification_id", "notification_id"),
        Index("ix_notification_delivery_attempts_channel", "channel"),
    )


class NotificationEvent(CRMBase, TimestampMixin):
    __tablename__ = "notification_events"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    event_type: Mapped[str] = mapped_column(String(255), nullable=False)
    payload: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    event_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, unique=True)
    delivered_to_telegram: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    telegram_message_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    telegram_delivery_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    telegram_delivery_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    telegram_delivery_occurred_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("ix_notification_events_event_type", "event_type"),
        Index("ix_notification_events_telegram_message_id", "telegram_message_id"),
    )
