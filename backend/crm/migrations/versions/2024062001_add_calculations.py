"""Add calculations table and link policies"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "2024062001_add_calculations"
down_revision = "2024061501_add_payments_module"
branch_labels = None
depends_on = None


CALCULATIONS_STATUS_INDEX = "ix_calculations_status"
CALCULATIONS_DATE_INDEX = "ix_calculations_calculation_date"
CALCULATIONS_COMPANY_INDEX = "ix_calculations_insurance_company"
POLICIES_CALCULATION_INDEX = "ix_policies_calculation_id"


def upgrade() -> None:
    op.create_table(
        "calculations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("insurance_company", sa.String(length=255), nullable=False),
        sa.Column("program_name", sa.String(length=255), nullable=True),
        sa.Column("premium_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("coverage_sum", sa.Numeric(14, 2), nullable=True),
        sa.Column("calculation_date", sa.Date(), nullable=False),
        sa.Column("validity_period", postgresql.DATERANGE(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column(
            "files",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["deal_id"], ["crm.deals.id"], ondelete="RESTRICT"),
        schema="crm",
    )
    op.create_index(CALCULATIONS_STATUS_INDEX, "calculations", ["status"], schema="crm")
    op.create_index(CALCULATIONS_DATE_INDEX, "calculations", ["calculation_date"], schema="crm")
    op.create_index(CALCULATIONS_COMPANY_INDEX, "calculations", ["insurance_company"], schema="crm")

    op.add_column(
        "policies",
        sa.Column("calculation_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="crm",
    )
    op.create_foreign_key(
        "fk_policies_calculation",
        "policies",
        "calculations",
        ["calculation_id"],
        ["id"],
        source_schema="crm",
        referent_schema="crm",
        ondelete="SET NULL",
    )
    op.create_index(POLICIES_CALCULATION_INDEX, "policies", ["calculation_id"], schema="crm")


def downgrade() -> None:
    op.drop_index(POLICIES_CALCULATION_INDEX, table_name="policies", schema="crm")
    op.drop_constraint("fk_policies_calculation", "policies", schema="crm", type_="foreignkey")
    op.drop_column("policies", "calculation_id", schema="crm")

    op.drop_index(CALCULATIONS_COMPANY_INDEX, table_name="calculations", schema="crm")
    op.drop_index(CALCULATIONS_DATE_INDEX, table_name="calculations", schema="crm")
    op.drop_index(CALCULATIONS_STATUS_INDEX, table_name="calculations", schema="crm")
    op.drop_table("calculations", schema="crm")
