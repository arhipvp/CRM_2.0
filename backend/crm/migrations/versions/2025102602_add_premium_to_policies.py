"""Add premium column to policies

Revision ID: 2025102602_add_premium_to_policies
Revises: 2025102601_add_tasks_module
Create Date: 2025-10-26 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2025102602_add_premium_to_policies"
down_revision = "2025102601_add_tasks_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "policies",
        sa.Column("premium", sa.Numeric(12, 2), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    op.drop_column("policies", "premium", schema="crm")
