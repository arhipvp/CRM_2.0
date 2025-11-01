from __future__ import annotations

import logging
from typing import Any, Sequence

from uuid import UUID

from PySide6.QtWidgets import QMessageBox

from api.client import APIClientError
from core.app_context import AppContext
from models import Task
from ui.base_table import BaseTableTab
from ui.worker import Worker, WorkerPool
from i18n import _

logger = logging.getLogger(__name__)


class TasksTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=[_("ID"), _("Title"), _("Description"), _("Status"), _("Assignee"), _("Author"), _("Deal"), _("Policy"), _("Due"), _("Created"), _("Updated"), _("Deleted")],
            title=_("Tasks"),
            parent=parent,
            enable_add=False,
            enable_edit=False,
            enable_delete=True,
        )
        self._context = context
        self._worker_pool = WorkerPool()

    def load_data(self) -> None:
        """Load tasks from API in background thread."""
        if self._worker_pool.is_running("load_tasks"):
            logger.debug("Tasks load already in progress")
            return

        self.data_loading.emit(True)

        def load_tasks_task() -> list[Task]:
            return self._context.api.fetch_tasks()

        worker = Worker(load_tasks_task)
        worker.finished.connect(self._on_tasks_loaded)  # type: ignore[arg-type]
        worker.error.connect(self._on_load_error)  # type: ignore[arg-type]
        self._worker_pool.start("load_tasks", worker)

    def _on_tasks_loaded(self, tasks: Any) -> None:
        """Handle successful tasks load.

        Args:
            tasks: List of Task objects from API
        """
        self.data_loading.emit(False)
        if not isinstance(tasks, list):
            self.operation_error.emit(_("Invalid response type"))
            return

        self._context.update_tasks(tasks)
        self.populate(self._to_rows(tasks))

    def _on_load_error(self, error_message: str) -> None:
        """Handle load error.

        Args:
            error_message: Error description
        """
        self.data_loading.emit(False)

        # Try to show cached data if available
        cached_tasks = list(self._context.cache.tasks.values())
        if cached_tasks:
            logger.warning("API error, showing cached data: %s", error_message)
            self.populate(self._to_rows(cached_tasks))
            self.operation_error.emit(_("Showing cached data (network error: {})").format(error_message))
        else:
            # No cache available
            self.operation_error.emit(error_message)

    def on_delete(self, index: int, row: Sequence[str]) -> None:
        """Handle delete task action.

        Args:
            index: Row index in table
            row: Row values from table
        """
        task = self._context.cache.tasks[UUID(row[0])]
        confirmation = QMessageBox.question(
            self,
            _("Delete task"),
            _("Delete task \"{}\"?").format(task.title),
            QMessageBox.Yes | QMessageBox.No,
        )
        if confirmation != QMessageBox.Yes:
            return

        self.data_loading.emit(True)

        def delete_task_task() -> None:
            self._context.api.delete_task(task.id)

        worker = Worker(delete_task_task)
        worker.finished.connect(self._on_task_deleted)
        worker.error.connect(self._on_delete_error)
        self._worker_pool.start("delete_task", worker)

    def _on_task_deleted(self, result: Any) -> None:
        """Handle successful task deletion.

        Args:
            result: Result from API (usually None)
        """
        self.data_loading.emit(False)
        self.load_data()
        QMessageBox.information(self, _("Success"), _("Task removed."))

    def _on_delete_error(self, error_message: str) -> None:
        """Handle task deletion error.

        Args:
            error_message: Error description
        """
        self.data_loading.emit(False)
        self.operation_error.emit(_("Failed to delete task: {}").format(error_message))

    def _to_rows(self, tasks: list[Task]):
        for task in tasks:
            # Get deal and policy titles for display
            deal_title = self._context.get_deal_title(task.deal_id) if task.deal_id else ""
            policy_number = self._context.get_policy_number(task.policy_id) if task.policy_id else ""

            yield (
                str(task.id),
                task.title,
                task.description or "",
                task.status_name or task.status_code or "",
                str(task.assignee_id) if task.assignee_id else "",
                str(task.author_id) if task.author_id else "",
                deal_title,
                policy_number,
                task.due_at.strftime("%Y-%m-%d %H:%M") if task.due_at else "",
                task.created_at.strftime("%Y-%m-%d %H:%M") if task.created_at else "",
                task.updated_at.strftime("%Y-%m-%d %H:%M") if task.updated_at else "",
                _("Yes") if task.is_deleted else _("No"),
            )
