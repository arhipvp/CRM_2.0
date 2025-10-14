"""Create deal journal table"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "2024062001_add_deal_journal"
down_revision = "2024061501_add_payments_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "deal_journal",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["deal_id"], ["crm.deals.id"], ondelete="CASCADE"),
        schema="crm",
    )
    op.create_index("ix_deal_journal_deal_id", "deal_journal", ["deal_id"], schema="crm")
    op.create_index("ix_deal_journal_created_at", "deal_journal", ["created_at"], schema="crm")


def downgrade() -> None:
    op.drop_index("ix_deal_journal_created_at", table_name="deal_journal", schema="crm")
    op.drop_index("ix_deal_journal_deal_id", table_name="deal_journal", schema="crm")
    op.drop_table("deal_journal", schema="crm")
