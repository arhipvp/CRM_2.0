"""Add permission sync jobs table"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "2024060101"
down_revision = "2024052801_add_next_review_at_to_deals"
branch_labels = ("crm",)
depends_on = None


def upgrade() -> None:
    op.create_table(
        "permission_sync_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_type", sa.String(length=64), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("queue_name", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column(
            "users",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("last_error", sa.Text(), nullable=True),
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
        schema="crm",
    )
    op.create_index(
        "ix_permission_sync_jobs_tenant",
        "permission_sync_jobs",
        ["tenant_id"],
        schema="crm",
    )
    op.create_index(
        "ix_permission_sync_jobs_owner",
        "permission_sync_jobs",
        ["owner_id"],
        schema="crm",
    )
    op.create_index(
        "ix_permission_sync_jobs_owner_type",
        "permission_sync_jobs",
        ["owner_type"],
        schema="crm",
    )
    op.create_index(
        "ix_permission_sync_jobs_status",
        "permission_sync_jobs",
        ["status"],
        schema="crm",
    )


def downgrade() -> None:
    op.drop_index("ix_permission_sync_jobs_status", table_name="permission_sync_jobs", schema="crm")
    op.drop_index("ix_permission_sync_jobs_owner_type", table_name="permission_sync_jobs", schema="crm")
    op.drop_index("ix_permission_sync_jobs_owner", table_name="permission_sync_jobs", schema="crm")
    op.drop_index("ix_permission_sync_jobs_tenant", table_name="permission_sync_jobs", schema="crm")
    op.drop_table("permission_sync_jobs", schema="crm")
