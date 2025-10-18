from __future__ import annotations

from alembic import op
from sqlalchemy.dialects import postgresql


revision = "2024072201"
down_revision = "2024071801"
branch_labels = ("crm",)
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "deals",
        "owner_id",
        schema="crm",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "deals",
        "owner_id",
        schema="crm",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
