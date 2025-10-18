"""Add payments tables and remove legacy sync log"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "2024061501_add_payments_module"
down_revision = "2024060101_add_permission_sync_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS crm.payment_sync_log CASCADE"))

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("policy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="scheduled"),
        sa.Column("planned_date", sa.Date(), nullable=True),
        sa.Column("actual_date", sa.Date(), nullable=True),
        sa.Column("planned_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=12), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("recorded_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("incomes_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("expenses_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("net_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        schema="crm",
    )
    op.create_index("ix_payments_tenant_id", "payments", ["tenant_id"], schema="crm")
    op.create_index("ix_payments_deal_id", "payments", ["deal_id"], schema="crm")
    op.create_index("ix_payments_policy_id", "payments", ["policy_id"], schema="crm")
    op.create_index("ix_payments_status", "payments", ["status"], schema="crm")
    op.create_index(
        "ux_payments_policy_sequence",
        "payments",
        ["policy_id", "sequence"],
        unique=True,
        schema="crm",
    )

    op.create_table(
        "payment_incomes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=12), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("posted_at", sa.Date(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["payment_id"], ["crm.payments.id"], ondelete="CASCADE"),
        schema="crm",
    )
    op.create_index("ix_payment_incomes_tenant", "payment_incomes", ["tenant_id"], schema="crm")
    op.create_index("ix_payment_incomes_payment", "payment_incomes", ["payment_id"], schema="crm")

    op.create_table(
        "payment_expenses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=12), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("posted_at", sa.Date(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["payment_id"], ["crm.payments.id"], ondelete="CASCADE"),
        schema="crm",
    )
    op.create_index("ix_payment_expenses_tenant", "payment_expenses", ["tenant_id"], schema="crm")
    op.create_index("ix_payment_expenses_payment", "payment_expenses", ["payment_id"], schema="crm")


def downgrade() -> None:
    op.drop_index("ix_payment_expenses_payment", table_name="payment_expenses", schema="crm")
    op.drop_index("ix_payment_expenses_tenant", table_name="payment_expenses", schema="crm")
    op.drop_table("payment_expenses", schema="crm")

    op.drop_index("ix_payment_incomes_payment", table_name="payment_incomes", schema="crm")
    op.drop_index("ix_payment_incomes_tenant", table_name="payment_incomes", schema="crm")
    op.drop_table("payment_incomes", schema="crm")

    op.drop_index("ux_payments_policy_sequence", table_name="payments", schema="crm")
    op.drop_index("ix_payments_status", table_name="payments", schema="crm")
    op.drop_index("ix_payments_policy_id", table_name="payments", schema="crm")
    op.drop_index("ix_payments_deal_id", table_name="payments", schema="crm")
    op.drop_index("ix_payments_tenant_id", table_name="payments", schema="crm")
    op.drop_table("payments", schema="crm")

    op.create_table(
        "payment_sync_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("payment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("policy_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(length=12), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        schema="crm",
    )
    op.create_index("ix_payment_sync_log_status", "payment_sync_log", ["status"], schema="crm")
    op.create_index("ix_payment_sync_log_payment", "payment_sync_log", ["payment_id"], schema="crm")
