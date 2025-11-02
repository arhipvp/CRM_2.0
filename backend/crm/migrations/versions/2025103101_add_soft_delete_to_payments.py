"""Add soft delete flags to payments and related tables"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "2025103101_add_soft_delete_to_payments"
down_revision = "2025102604_migrate_crm_tasks_to_tasks_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "payments",
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        schema="crm",
    )
    op.add_column(
        "payment_incomes",
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        schema="crm",
    )
    op.add_column(
        "payment_expenses",
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        schema="crm",
    )

    op.create_index("ix_payments_is_deleted", "payments", ["is_deleted"], schema="crm")
    op.create_index(
        "ix_payment_incomes_is_deleted",
        "payment_incomes",
        ["is_deleted"],
        schema="crm",
    )
    op.create_index(
        "ix_payment_expenses_is_deleted",
        "payment_expenses",
        ["is_deleted"],
        schema="crm",
    )

    op.alter_column(
        "payments",
        "is_deleted",
        schema="crm",
        server_default=None,
        existing_type=sa.Boolean(),
    )
    op.alter_column(
        "payment_incomes",
        "is_deleted",
        schema="crm",
        server_default=None,
        existing_type=sa.Boolean(),
    )
    op.alter_column(
        "payment_expenses",
        "is_deleted",
        schema="crm",
        server_default=None,
        existing_type=sa.Boolean(),
    )


def downgrade() -> None:
    op.alter_column(
        "payment_expenses",
        "is_deleted",
        schema="crm",
        server_default=sa.text("false"),
        existing_type=sa.Boolean(),
    )
    op.alter_column(
        "payment_incomes",
        "is_deleted",
        schema="crm",
        server_default=sa.text("false"),
        existing_type=sa.Boolean(),
    )
    op.alter_column(
        "payments",
        "is_deleted",
        schema="crm",
        server_default=sa.text("false"),
        existing_type=sa.Boolean(),
    )

    op.drop_index("ix_payment_expenses_is_deleted", table_name="payment_expenses", schema="crm")
    op.drop_index("ix_payment_incomes_is_deleted", table_name="payment_incomes", schema="crm")
    op.drop_index("ix_payments_is_deleted", table_name="payments", schema="crm")

    op.drop_column("payment_expenses", "is_deleted", schema="crm")
    op.drop_column("payment_incomes", "is_deleted", schema="crm")
    op.drop_column("payments", "is_deleted", schema="crm")
