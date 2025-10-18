from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "2024071801"
down_revision = "2024070101_add_payments_foreign_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("deals", "value", schema="crm")


def downgrade() -> None:
    op.add_column(
        "deals",
        sa.Column("value", sa.Numeric(12, 2), nullable=True),
        schema="crm",
    )
