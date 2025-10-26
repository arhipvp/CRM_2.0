"""Remove tenant_id columns from all tables"""
from __future__ import annotations

from alembic import op


revision = '2025102501_remove_tenant_id'
down_revision = "2024072801"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop indexes containing tenant_id
    op.drop_index("ix_clients_tenant_id", table_name="clients", schema="crm", if_exists=True)
    op.drop_index("ix_deals_tenant_id", table_name="deals", schema="crm", if_exists=True)
    op.drop_index("ix_calculations_tenant_id", table_name="calculations", schema="crm", if_exists=True)
    op.drop_index("ix_tasks_tenant_id", table_name="tasks", schema="crm", if_exists=True)
    op.drop_index("ix_payments_tenant_id", table_name="payments", schema="crm", if_exists=True)
    op.drop_index("ix_payment_incomes_tenant_id", table_name="payment_incomes", schema="crm", if_exists=True)
    op.drop_index("ix_payment_expenses_tenant_id", table_name="payment_expenses", schema="crm", if_exists=True)
    op.drop_index("ix_policy_documents_tenant_id", table_name="policy_documents", schema="crm", if_exists=True)
    op.drop_index("ix_permission_sync_jobs_tenant", table_name="permission_sync_jobs", schema="crm", if_exists=True)

    # Remove tenant_id columns from tables where it may still exist.
    # Using raw SQL with IF EXISTS keeps the migration idempotent even if
    # some tables (e.g. policies) never had the column.
    op.execute("ALTER TABLE crm.clients DROP COLUMN IF EXISTS tenant_id")
    op.execute("ALTER TABLE crm.deals DROP COLUMN IF EXISTS tenant_id")
    op.execute("ALTER TABLE crm.calculations DROP COLUMN IF EXISTS tenant_id")
    op.execute("ALTER TABLE crm.tasks DROP COLUMN IF EXISTS tenant_id")
    op.execute("ALTER TABLE crm.payments DROP COLUMN IF EXISTS tenant_id")
    op.execute("ALTER TABLE crm.payment_incomes DROP COLUMN IF EXISTS tenant_id")
    op.execute("ALTER TABLE crm.payment_expenses DROP COLUMN IF EXISTS tenant_id")
    op.execute("ALTER TABLE crm.policy_documents DROP COLUMN IF EXISTS tenant_id")
    op.execute("ALTER TABLE crm.permission_sync_jobs DROP COLUMN IF EXISTS tenant_id")


def downgrade() -> None:
    # This is a destructive migration - adding tenant_id back would require
    # knowing what tenant each record belongs to, which information is lost.
    # Downgrade is not supported for this migration.
    raise NotImplementedError(
        "Downgrading from removal of tenant_id is not supported. "
        "This is a destructive migration that removes multi-tenancy support."
    )
