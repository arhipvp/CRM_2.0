"""Placeholder migration after moving tasks schema to dedicated service.

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
    # Структура схемы tasks управляется сервисом задач (TypeORM миграции).
    # Alembic миграция сохранена для совместимости истории CRM и намеренно
    # не выполняет действий, чтобы избежать дублирования DDL.
    op.get_bind()  # Убеждаемся, что соединение установлено.


def downgrade() -> None:
    # Обратная операция также не требуется: таблицы остаются под управлением
    # сервиса задач. Alembic хранит ревизию только для согласованности цепочки.
    op.get_bind()
