"""Allow NULL owner for clients

Revision ID: 2025102602_allow_null_owner_in_clients
Revises: 2025102601_add_tasks_module
Create Date: 2025-10-26 00:00:00.000001
"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "2025102602_allow_null_owner_in_clients"
down_revision = "2025102601_add_tasks_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("clients", "owner_id", schema="crm", nullable=True)


def downgrade() -> None:
    op.alter_column("clients", "owner_id", schema="crm", nullable=False)
