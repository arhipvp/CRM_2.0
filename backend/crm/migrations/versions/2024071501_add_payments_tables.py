"""Add payments tables"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "2024071501"
down_revision = "2024060101_add_permission_sync_jobs"
branch_labels = ("crm",)
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("policy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="scheduled"),
        sa.Column("planned_date", sa.Date(), nullable=True),
        sa.Column("actual_date", sa.Date(), nullable=True),
        sa.Column("planned_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=12), nullable=False, server_default="RUB"),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("recorded_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("incomes_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("expenses_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("net_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
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
        sa.ForeignKeyConstraint(["deal_id"], ["crm.deals.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["policy_id"], ["crm.policies.id"], ondelete="RESTRICT"),
        schema="crm",
    )
    op.create_index("ix_payments_policy_actual", "payments", ["policy_id", "actual_date"], schema="crm")
    op.create_index("ix_payments_deal", "payments", ["deal_id"], schema="crm")
    op.create_index("ix_payments_sequence", "payments", ["policy_id", "sequence"], unique=True, schema="crm")
    op.create_index("ix_payments_tenant", "payments", ["tenant_id"], schema="crm")
    op.create_index("ix_payments_owner", "payments", ["owner_id"], schema="crm")

    op.create_table(
        "payment_incomes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("payment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=12), nullable=False, server_default="RUB"),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("posted_at", sa.Date(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["payment_id"], ["crm.payments.id"], ondelete="CASCADE"),
        schema="crm",
    )
    op.create_index("ix_payment_incomes_payment", "payment_incomes", ["payment_id"], schema="crm")
    op.create_index(
        "ix_payment_incomes_posted_payment",
        "payment_incomes",
        ["posted_at", "payment_id"],
        schema="crm",
    )
    op.create_index("ix_payment_incomes_tenant", "payment_incomes", ["tenant_id"], schema="crm")
    op.create_index("ix_payment_incomes_owner", "payment_incomes", ["owner_id"], schema="crm")

    op.create_table(
        "payment_expenses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("payment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=12), nullable=False, server_default="RUB"),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("posted_at", sa.Date(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["payment_id"], ["crm.payments.id"], ondelete="CASCADE"),
        schema="crm",
    )
    op.create_index("ix_payment_expenses_payment", "payment_expenses", ["payment_id"], schema="crm")
    op.create_index(
        "ix_payment_expenses_posted_payment",
        "payment_expenses",
        ["posted_at", "payment_id"],
        schema="crm",
    )
    op.create_index("ix_payment_expenses_tenant", "payment_expenses", ["tenant_id"], schema="crm")
    op.create_index("ix_payment_expenses_owner", "payment_expenses", ["owner_id"], schema="crm")


def downgrade() -> None:
    op.drop_index("ix_payment_expenses_owner", table_name="payment_expenses", schema="crm")
    op.drop_index("ix_payment_expenses_tenant", table_name="payment_expenses", schema="crm")
    op.drop_index("ix_payment_expenses_posted_payment", table_name="payment_expenses", schema="crm")
    op.drop_index("ix_payment_expenses_payment", table_name="payment_expenses", schema="crm")
    op.drop_table("payment_expenses", schema="crm")

    op.drop_index("ix_payment_incomes_owner", table_name="payment_incomes", schema="crm")
    op.drop_index("ix_payment_incomes_tenant", table_name="payment_incomes", schema="crm")
    op.drop_index("ix_payment_incomes_posted_payment", table_name="payment_incomes", schema="crm")
    op.drop_index("ix_payment_incomes_payment", table_name="payment_incomes", schema="crm")
    op.drop_table("payment_incomes", schema="crm")

    op.drop_index("ix_payments_owner", table_name="payments", schema="crm")
    op.drop_index("ix_payments_tenant", table_name="payments", schema="crm")
    op.drop_index("ix_payments_sequence", table_name="payments", schema="crm")
    op.drop_index("ix_payments_deal", table_name="payments", schema="crm")
    op.drop_index("ix_payments_policy_actual", table_name="payments", schema="crm")
    op.drop_table("payments", schema="crm")
