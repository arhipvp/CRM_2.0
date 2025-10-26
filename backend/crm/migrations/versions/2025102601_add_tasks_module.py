"""Add tasks schema and reminders

Revision ID: 2025102601_add_tasks_module
Revises: 2025102501_remove_tenant_id
Create Date: 2025-10-26 00:00:00.000000
"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "2025102601_add_tasks_module"
down_revision = "2025102501_remove_tenant_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_foreign_key(
        "fk_tasks_assignee_id",
        "tasks",
        "users",
        ["assignee_id"],
        ["id"],
        source_schema="tasks",
        referent_schema="auth",
        ondelete="RESTRICT",
        onupdate="CASCADE",
    )
    op.create_foreign_key(
        "fk_tasks_author_id",
        "tasks",
        "users",
        ["author_id"],
        ["id"],
        source_schema="tasks",
        referent_schema="auth",
        ondelete="RESTRICT",
        onupdate="CASCADE",
    )
    op.create_foreign_key(
        "fk_tasks_deal_id",
        "tasks",
        "deals",
        ["deal_id"],
        ["id"],
        source_schema="tasks",
        referent_schema="crm",
        ondelete="SET NULL",
        onupdate="CASCADE",
    )
    op.create_foreign_key(
        "fk_tasks_policy_id",
        "tasks",
        "policies",
        ["policy_id"],
        ["id"],
        source_schema="tasks",
        referent_schema="crm",
        ondelete="SET NULL",
        onupdate="CASCADE",
    )
    op.create_foreign_key(
        "fk_tasks_payment_id",
        "tasks",
        "payments",
        ["payment_id"],
        ["id"],
        source_schema="tasks",
        referent_schema="crm",
        ondelete="SET NULL",
        onupdate="CASCADE",
    )
    op.create_foreign_key(
        "fk_task_activity_author_id",
        "task_activity",
        "users",
        ["author_id"],
        ["id"],
        source_schema="tasks",
        referent_schema="auth",
        ondelete="RESTRICT",
        onupdate="CASCADE",
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tasks_status_code ON tasks.tasks (status_code)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tasks_status_code_due_at ON tasks.tasks (status_code, due_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tasks_assignee_id ON tasks.tasks (assignee_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tasks_deal_id ON tasks.tasks (deal_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tasks_scheduled_for ON tasks.tasks (scheduled_for) WHERE scheduled_for IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tasks_due_at ON tasks.tasks (due_at) WHERE due_at IS NOT NULL"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_task_activity_created_at ON tasks.task_activity (created_at)"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_task_reminders_due ON tasks.task_reminders (remind_at)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_task_reminders_unique ON tasks.task_reminders (task_id, remind_at, channel)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS tasks.idx_task_reminders_unique")
    op.execute("DROP INDEX IF EXISTS tasks.ix_task_reminders_due")

    op.execute("DROP INDEX IF EXISTS tasks.ix_task_activity_created_at")

    op.execute("DROP INDEX IF EXISTS tasks.ix_tasks_due_at")
    op.execute("DROP INDEX IF EXISTS tasks.ix_tasks_scheduled_for")
    op.execute("DROP INDEX IF EXISTS tasks.ix_tasks_deal_id")
    op.execute("DROP INDEX IF EXISTS tasks.ix_tasks_assignee_id")
    op.execute("DROP INDEX IF EXISTS tasks.ix_tasks_status_code_due_at")
    op.execute("DROP INDEX IF EXISTS tasks.ix_tasks_status_code")

    op.drop_constraint("fk_task_activity_author_id", "task_activity", schema="tasks", type_="foreignkey")
    op.drop_constraint("fk_tasks_payment_id", "tasks", schema="tasks", type_="foreignkey")
    op.drop_constraint("fk_tasks_policy_id", "tasks", schema="tasks", type_="foreignkey")
    op.drop_constraint("fk_tasks_deal_id", "tasks", schema="tasks", type_="foreignkey")
    op.drop_constraint("fk_tasks_author_id", "tasks", schema="tasks", type_="foreignkey")
    op.drop_constraint("fk_tasks_assignee_id", "tasks", schema="tasks", type_="foreignkey")
