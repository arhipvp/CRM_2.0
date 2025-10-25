"""Add next review date to deals"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "2024052801_add_next_review_at_to_deals"
down_revision = "2024031502_update_alembic_version_length"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "deals",
        sa.Column(
            "next_review_at",
            sa.Date(),
            nullable=False,
            server_default=sa.text("CURRENT_DATE"),
        ),
        schema="crm",
    )
    op.execute("UPDATE crm.deals SET next_review_at = CURRENT_DATE WHERE next_review_at IS NULL")
    op.create_index(
        "ix_deals_next_review_at",
        "deals",
        ["next_review_at"],
        schema="crm",
    )


def downgrade() -> None:
    op.drop_index("ix_deals_next_review_at", table_name="deals", schema="crm")
    op.drop_column("deals", "next_review_at", schema="crm")
