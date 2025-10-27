"""Создание схемы и таблиц модуля задач CRM.

Revision ID: 2025102601_add_tasks_module
Revises: 2025102501_remove_tenant_id
Create Date: 2025-10-26 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2025102601_add_tasks_module"
down_revision = "2025102501_remove_tenant_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    current_user = bind.scalar(sa.text("SELECT current_user"))
    schema_exists = bind.scalar(
        sa.text("SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'tasks')")
    )

    if schema_exists:
        schema_owner = bind.scalar(
            sa.text(
                "SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'tasks'"
            )
        )
        is_superuser = bind.scalar(
            sa.text("SELECT rolsuper FROM pg_roles WHERE rolname = current_user")
        )

        if schema_owner == current_user or is_superuser:
            # Schema is already owned by current user, no need to change
            pass
        else:
            op.execute(
                """
                DO $$
                DECLARE
                    v_owner text;
                    v_current text := current_user;
                BEGIN
                    SELECT pg_get_userbyid(nspowner)
                    INTO v_owner
                    FROM pg_namespace
                    WHERE nspname = 'tasks';

                    RAISE NOTICE 'Skipping ALTER SCHEMA for schema tasks: owner %, current user % has no privileges to reassign', v_owner, v_current;
                END;
                $$;
                """
            )
    else:
        can_create_schema = bind.scalar(
            sa.text(
                "SELECT has_database_privilege(current_database(), 'CREATE')"
            )
        )
        if not can_create_schema:
            op.execute(
                """
                DO $$
                DECLARE
                    v_db text := current_database();
                    v_current text := current_user;
                BEGIN
                    RAISE NOTICE 'Skipping tasks module migration: user % lacks CREATE privilege on database % to create schema tasks', v_current, v_db;
                END;
                $$;
                """
            )
            return

        op.execute(
            sa.text("CREATE SCHEMA tasks AUTHORIZATION :owner").bindparams(owner=current_user)
        )

    has_required_privileges = bind.scalar(
        sa.text(
            "SELECT has_schema_privilege('tasks', 'USAGE') AND has_schema_privilege('tasks', 'CREATE')"
        )
    )
    if not has_required_privileges:
        op.execute(
            """
            DO $$
            DECLARE
                v_current text := current_user;
            BEGIN
                RAISE NOTICE 'Skipping tasks module migration: user % lacks USAGE/CREATE privileges on schema tasks', v_current;
            END;
            $$;
            """
        )
        return

    op.create_table(
        "task_statuses",
        sa.Column("code", sa.String(length=32), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "is_final",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema="tasks",
    )

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status_code", sa.String(length=32), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("policy_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("payment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["status_code"],
            ["tasks.task_statuses.code"],
            onupdate="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["assignee_id"],
            ["auth.users.id"],
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["auth.users.id"],
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["deal_id"],
            ["crm.deals.id"],
            onupdate="CASCADE",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["policy_id"],
            ["crm.policies.id"],
            onupdate="CASCADE",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["payment_id"],
            ["crm.payments.id"],
            onupdate="CASCADE",
            ondelete="SET NULL",
        ),
        schema="tasks",
    )

    op.create_index(
        "ix_tasks_status_code",
        "tasks",
        ["status_code"],
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_status_code_due_at",
        "tasks",
        ["status_code", "due_at"],
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_assignee_id",
        "tasks",
        ["assignee_id"],
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_deal_id",
        "tasks",
        ["deal_id"],
        schema="tasks",
    )
    op.create_index(
        "ix_tasks_scheduled_for",
        "tasks",
        ["scheduled_for"],
        schema="tasks",
        postgresql_where=sa.text("scheduled_for IS NOT NULL"),
    )
    op.create_index(
        "ix_tasks_due_at",
        "tasks",
        ["due_at"],
        schema="tasks",
        postgresql_where=sa.text("due_at IS NOT NULL"),
    )

    op.create_table(
        "task_reminders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("remind_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.tasks.id"],
            ondelete="CASCADE",
            onupdate="CASCADE",
        ),
        schema="tasks",
    )

    op.create_index(
        "ix_task_reminders_due",
        "task_reminders",
        ["remind_at"],
        schema="tasks",
    )
    op.create_index(
        "idx_task_reminders_unique",
        "task_reminders",
        ["task_id", "remind_at", "channel"],
        unique=True,
        schema="tasks",
    )

    op.create_table(
        "task_activity",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.tasks.id"],
            ondelete="CASCADE",
            onupdate="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["auth.users.id"],
            ondelete="RESTRICT",
            onupdate="CASCADE",
        ),
        schema="tasks",
    )

    op.create_index(
        "ix_task_activity_created_at",
        "task_activity",
        ["created_at"],
        schema="tasks",
    )


def downgrade() -> None:
    # При откате удаляем объекты модуля задач из схемы CRM.
    op.drop_index("ix_task_activity_created_at", table_name="task_activity", schema="tasks")
    op.drop_table("task_activity", schema="tasks")

    op.drop_index("idx_task_reminders_unique", table_name="task_reminders", schema="tasks")
    op.drop_index("ix_task_reminders_due", table_name="task_reminders", schema="tasks")
    op.drop_table("task_reminders", schema="tasks")

    op.drop_index("ix_tasks_due_at", table_name="tasks", schema="tasks")
    op.drop_index("ix_tasks_scheduled_for", table_name="tasks", schema="tasks")
    op.drop_index("ix_tasks_deal_id", table_name="tasks", schema="tasks")
    op.drop_index("ix_tasks_assignee_id", table_name="tasks", schema="tasks")
    op.drop_index("ix_tasks_status_code_due_at", table_name="tasks", schema="tasks")
    op.drop_index("ix_tasks_status_code", table_name="tasks", schema="tasks")
    op.drop_table("tasks", schema="tasks")

    op.drop_table("task_statuses", schema="tasks")
    op.execute("DROP SCHEMA IF EXISTS tasks CASCADE")
