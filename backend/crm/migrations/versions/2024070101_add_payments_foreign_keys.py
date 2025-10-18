"""Add foreign keys to payments"""

from __future__ import annotations

from alembic import op


revision = "2024070101"
down_revision = "2024062401_add_policy_documents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_foreign_key(
        "fk_payments_deal_id",
        "payments",
        "deals",
        ["deal_id"],
        ["id"],
        source_schema="crm",
        referent_schema="crm",
        ondelete="RESTRICT",
        onupdate="CASCADE",
    )
    op.create_foreign_key(
        "fk_payments_policy_id",
        "payments",
        "policies",
        ["policy_id"],
        ["id"],
        source_schema="crm",
        referent_schema="crm",
        ondelete="RESTRICT",
        onupdate="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_payments_policy_id",
        "payments",
        schema="crm",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_payments_deal_id",
        "payments",
        schema="crm",
        type_="foreignkey",
    )
