"""Add notifications tables"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "2024072801"
down_revision = "2024072201"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(length=255), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("locale", sa.String(length=16), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'active'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("key", "channel", name="uq_notification_templates_key_channel"),
        schema="crm",
    )
    op.create_index(
        "ix_notification_templates_channel",
        "notification_templates",
        ["channel"],
        schema="crm",
    )
    op.create_index(
        "ix_notification_templates_status",
        "notification_templates",
        ["status"],
        schema="crm",
    )
    op.create_index(
        "ix_notification_templates_locale",
        "notification_templates",
        ["locale"],
        schema="crm",
    )

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_key", sa.String(length=255), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("recipients", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "channel_overrides",
            postgresql.ARRAY(sa.String(length=64)),
            nullable=True,
        ),
        sa.Column(
            "deduplication_key", sa.String(length=255), nullable=True, unique=True
        ),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column(
            "attempts_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        schema="crm",
    )
    op.create_index(
        "ix_notifications_event_key",
        "notifications",
        ["event_key"],
        schema="crm",
    )
    op.create_index(
        "ix_notifications_status",
        "notifications",
        ["status"],
        schema="crm",
    )

    op.create_table(
        "notification_delivery_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("notification_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("channel", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["notification_id"],
            ["crm.notifications.id"],
            ondelete="CASCADE",
        ),
        schema="crm",
    )
    op.create_index(
        "ix_notification_delivery_attempts_notification_id",
        "notification_delivery_attempts",
        ["notification_id"],
        schema="crm",
    )
    op.create_index(
        "ix_notification_delivery_attempts_channel",
        "notification_delivery_attempts",
        ["channel"],
        schema="crm",
    )

    op.create_table(
        "notification_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_type", sa.String(length=255), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=True, unique=True),
        sa.Column(
            "delivered_to_telegram",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("telegram_message_id", sa.String(length=128), nullable=True),
        sa.Column("telegram_delivery_status", sa.String(length=32), nullable=True),
        sa.Column("telegram_delivery_reason", sa.Text(), nullable=True),
        sa.Column(
            "telegram_delivery_occurred_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        schema="crm",
    )
    op.create_index(
        "ix_notification_events_event_type",
        "notification_events",
        ["event_type"],
        schema="crm",
    )
    op.create_index(
        "ix_notification_events_telegram_message_id",
        "notification_events",
        ["telegram_message_id"],
        schema="crm",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_notification_events_telegram_message_id",
        table_name="notification_events",
        schema="crm",
    )
    op.drop_index(
        "ix_notification_events_event_type",
        table_name="notification_events",
        schema="crm",
    )
    op.drop_table("notification_events", schema="crm")

    op.drop_index(
        "ix_notification_delivery_attempts_channel",
        table_name="notification_delivery_attempts",
        schema="crm",
    )
    op.drop_index(
        "ix_notification_delivery_attempts_notification_id",
        table_name="notification_delivery_attempts",
        schema="crm",
    )
    op.drop_table("notification_delivery_attempts", schema="crm")

    op.drop_index(
        "ix_notifications_status",
        table_name="notifications",
        schema="crm",
    )
    op.drop_index(
        "ix_notifications_event_key",
        table_name="notifications",
        schema="crm",
    )
    op.drop_table("notifications", schema="crm")

    op.drop_index(
        "ix_notification_templates_locale",
        table_name="notification_templates",
        schema="crm",
    )
    op.drop_index(
        "ix_notification_templates_status",
        table_name="notification_templates",
        schema="crm",
    )
    op.drop_index(
        "ix_notification_templates_channel",
        table_name="notification_templates",
        schema="crm",
    )
    op.drop_table("notification_templates", schema="crm")
