"""Add tasks schema and reminders

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
    op.execute("CREATE SCHEMA IF NOT EXISTS tasks")

    op.create_table(
        "task_statuses",
        sa.Column("code", sa.String(length=32), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_final", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema="tasks",
    )

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status_code",
            sa.String(length=32),
            sa.ForeignKey("tasks.task_statuses.code", onupdate="CASCADE"),
            nullable=False,
        ),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        schema="tasks",
    )

    op.create_index("ix_tasks_status_code", "tasks", ["status_code"], schema="tasks")
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
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.tasks.id", ondelete="CASCADE", onupdate="CASCADE"),
            nullable=False,
        ),
        sa.Column("remind_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema="tasks",
    )

    op.create_index("ix_task_reminders_due", "task_reminders", ["remind_at"], schema="tasks")
    op.create_index(
        "idx_task_reminders_unique",
        "task_reminders",
        ["task_id", "remind_at", "channel"],
        unique=True,
        schema="tasks",
    )

    op.execute(
        """
        INSERT INTO tasks.task_statuses (code, name, description, is_final)
        VALUES
            ('pending', 'Ожидает выполнения', 'Задача готова к взятию в работу или ожиданию воркера.', false),
            ('scheduled', 'Отложена', 'Задача ожидает наступления времени исполнения в Redis-очереди.', false),
            ('in_progress', 'В работе', 'Задача обрабатывается исполнителем или автоматикой.', false),
            ('completed', 'Завершена', 'Работа по задаче завершена успешно.', true),
            ('cancelled', 'Отменена', 'Задача отменена и не требует дальнейшей обработки.', true)
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            is_final = EXCLUDED.is_final
        """
    )


def downgrade() -> None:
    op.drop_index("idx_task_reminders_unique", table_name="task_reminders", schema="tasks")
    op.drop_index("ix_task_reminders_due", table_name="task_reminders", schema="tasks")
    op.drop_table("task_reminders", schema="tasks")

    op.drop_index("ix_tasks_due_at", table_name="tasks", schema="tasks")
    op.drop_index("ix_tasks_scheduled_for", table_name="tasks", schema="tasks")
    op.drop_index("ix_tasks_status_code", table_name="tasks", schema="tasks")
    op.drop_table("tasks", schema="tasks")

    op.drop_table("task_statuses", schema="tasks")
    op.execute("DROP SCHEMA IF EXISTS tasks CASCADE")
