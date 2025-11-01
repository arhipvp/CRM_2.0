from __future__ import annotations

import logging
from typing import Any, Sequence

from PySide6.QtWidgets import QMessageBox

from api.client import APIClientError
from core.app_context import AppContext
from models import Task
from ui.base_table import BaseTableTab
from ui.worker import Worker, WorkerPool

logger = logging.getLogger(__name__)


class TasksTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=["ID", "Title", "Description", "Status", "Assignee", "Author", "Deal", "Policy", "Due", "Created", "Updated"],
            title="Tasks",
            parent=parent,
            enable_add=False,
            enable_edit=False,
            enable_delete=False,
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
            self.operation_error.emit("Invalid response type")
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
            self.operation_error.emit(f"Showing cached data (network error: {error_message})")
        else:
            # No cache available
            self.operation_error.emit(error_message)

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
            )
