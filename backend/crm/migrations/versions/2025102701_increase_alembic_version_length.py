"""Increase Alembic version column length"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "2025102701_increase_alembic_version_length"
down_revision = "2025102601_add_tasks_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "alembic_version",
        "version_num",
        type_=sa.String(length=128),
        schema="crm",
    )


def downgrade() -> None:
    op.alter_column(
        "alembic_version",
        "version_num",
        type_=sa.String(length=32),
        schema="crm",
    )
