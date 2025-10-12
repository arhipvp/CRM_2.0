"""Initial CRM schema"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "2024031501"
down_revision = None
branch_labels = ("crm",)
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS crm")

    op.create_table(
        "clients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="active"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        schema="crm",
    )
    op.create_index("ix_clients_status", "clients", ["status"], schema="crm")
    op.create_index("ix_clients_tenant", "clients", ["tenant_id"], schema="crm")
    op.create_index("ix_clients_owner", "clients", ["owner_id"], schema="crm")

    op.create_table(
        "deals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("value", sa.Numeric(12, 2), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.ForeignKeyConstraint(["client_id"], ["crm.clients.id"], ondelete="RESTRICT"),
        schema="crm",
    )
    op.create_index("ix_deals_status", "deals", ["status"], schema="crm")
    op.create_index("ix_deals_tenant", "deals", ["tenant_id"], schema="crm")
    op.create_index("ix_deals_owner", "deals", ["owner_id"], schema="crm")

    op.create_table(
        "policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("policy_number", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("premium", sa.Numeric(12, 2), nullable=True),
        sa.Column("effective_from", sa.Date(), nullable=True),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.ForeignKeyConstraint(["client_id"], ["crm.clients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["deal_id"], ["crm.deals.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("policy_number"),
        schema="crm",
    )
    op.create_index("ix_policies_status", "policies", ["status"], schema="crm")
    op.create_index("ix_policies_client", "policies", ["client_id"], schema="crm")
    op.create_index("ix_policies_tenant", "policies", ["tenant_id"], schema="crm")
    op.create_index("ix_policies_owner", "policies", ["owner_id"], schema="crm")

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="open"),
        sa.Column("priority", sa.String(length=20), nullable=False, server_default="normal"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.ForeignKeyConstraint(["deal_id"], ["crm.deals.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["client_id"], ["crm.clients.id"], ondelete="SET NULL"),
        schema="crm",
    )
    op.create_index("ix_tasks_status", "tasks", ["status"], schema="crm")
    op.create_index("ix_tasks_due_date", "tasks", ["due_date"], schema="crm")
    op.create_index("ix_tasks_tenant", "tasks", ["tenant_id"], schema="crm")
    op.create_index("ix_tasks_owner", "tasks", ["owner_id"], schema="crm")

    op.create_table(
        "payment_sync_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("policy_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(length=12), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.UniqueConstraint("event_id"),
        schema="crm",
    )
    op.create_index("ix_payment_sync_log_status", "payment_sync_log", ["status"], schema="crm")
    op.create_index("ix_payment_sync_log_payment", "payment_sync_log", ["payment_id"], schema="crm")
    op.create_index("ix_payment_sync_log_tenant", "payment_sync_log", ["tenant_id"], schema="crm")
    op.create_index("ix_payment_sync_log_owner", "payment_sync_log", ["owner_id"], schema="crm")


def downgrade() -> None:
    op.drop_index("ix_payment_sync_log_owner", table_name="payment_sync_log", schema="crm")
    op.drop_index("ix_payment_sync_log_tenant", table_name="payment_sync_log", schema="crm")
    op.drop_index("ix_payment_sync_log_payment", table_name="payment_sync_log", schema="crm")
    op.drop_index("ix_payment_sync_log_status", table_name="payment_sync_log", schema="crm")
    op.drop_table("payment_sync_log", schema="crm")

    op.drop_index("ix_tasks_owner", table_name="tasks", schema="crm")
    op.drop_index("ix_tasks_tenant", table_name="tasks", schema="crm")
    op.drop_index("ix_tasks_due_date", table_name="tasks", schema="crm")
    op.drop_index("ix_tasks_status", table_name="tasks", schema="crm")
    op.drop_table("tasks", schema="crm")

    op.drop_index("ix_policies_owner", table_name="policies", schema="crm")
    op.drop_index("ix_policies_tenant", table_name="policies", schema="crm")
    op.drop_index("ix_policies_client", table_name="policies", schema="crm")
    op.drop_index("ix_policies_status", table_name="policies", schema="crm")
    op.drop_table("policies", schema="crm")

    op.drop_index("ix_deals_owner", table_name="deals", schema="crm")
    op.drop_index("ix_deals_tenant", table_name="deals", schema="crm")
    op.drop_index("ix_deals_status", table_name="deals", schema="crm")
    op.drop_table("deals", schema="crm")

    op.drop_index("ix_clients_owner", table_name="clients", schema="crm")
    op.drop_index("ix_clients_tenant", table_name="clients", schema="crm")
    op.drop_index("ix_clients_status", table_name="clients", schema="crm")
    op.drop_table("clients", schema="crm")

    op.execute("DROP SCHEMA IF EXISTS crm CASCADE")
