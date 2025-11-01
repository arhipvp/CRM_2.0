from __future__ import annotations

from PySide6.QtWidgets import QMessageBox

from api.client import APIClientError
from core.app_context import AppContext
from models import Task
from ui.base_table import BaseTableTab


class TasksTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=[
                "Название",
                "Описание",
                "Статус",
                "Исполнитель",
                "Дедлайн",
                "Создана",
            ],
            title="Задачи",
            parent=parent,
        )
        self._context = context

    def load_data(self) -> None:
        try:
            tasks = self._context.api.fetch_tasks()
        except APIClientError as exc:
            QMessageBox.warning(self, "Ошибка загрузки", str(exc))
            return

        self._context.update_tasks(tasks)
        self.populate(self._to_rows(tasks))

    @staticmethod
    def _to_rows(tasks: list[Task]):
        for task in tasks:
            yield (
                task.title,
                task.description or "",
                task.status_name or task.status_code or "",
                str(task.assignee_id or "")[:8],
                task.due_at.strftime("%Y-%m-%d %H:%M") if task.due_at else "",
                task.created_at.strftime("%Y-%m-%d %H:%M") if task.created_at else "",
            )

