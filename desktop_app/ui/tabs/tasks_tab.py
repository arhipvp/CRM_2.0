from __future__ import annotations

import logging
from typing import Any, Sequence

from PySide6.QtWidgets import QDialog, QMessageBox

from api.client import APIClientError
from core.app_context import AppContext
from models import Client, Deal, Policy, Task
from ui.base_table import BaseTableTab
from ui.dialogs.task_dialog import TaskDialog
from ui.worker import Worker, WorkerPool
from i18n import _

logger = logging.getLogger(__name__)


class TasksTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=[_("ID"), _("Title"), _("Description"), _("Status"), _("Assignee"), _("Author"), _("Deal"), _("Policy"), _("Due"), _("Created"), _("Updated"), _("Deleted")],
            title=_("Tasks"),
            parent=parent,
            enable_add=True,
            enable_edit=True,
            enable_delete=True,
        )
        self._context = context
        self._worker_pool = WorkerPool()
        self._tasks: list[Task] = []
        self._clients: list[Client] = []
        self._deals: list[Deal] = []
        self._policies: list[Policy] = []

    def load_data(self) -> None:
        """Load tasks from API in background thread."""
        if self._worker_pool.is_running("load_tasks"):
            logger.debug("Tasks load already in progress")
            return

        self.data_loading.emit(True)

        def load_tasks_task() -> tuple[list[Task], list[Deal], list[Policy], list[Client]]:
            tasks = self._context.api.fetch_tasks()
            deals = self._context.api.fetch_deals()
            policies = self._context.api.fetch_policies()
            clients = self._context.api.fetch_clients()
            return tasks, deals, policies, clients

        worker = Worker(load_tasks_task)
        worker.finished.connect(self._on_tasks_loaded)  # type: ignore[arg-type]
        worker.error.connect(self._on_load_error)  # type: ignore[arg-type]
        self._worker_pool.start("load_tasks", worker)

    def _on_tasks_loaded(self, result: Any) -> None:
        """Handle successful tasks load.

        Args:
            result: Tuple with tasks, deals, policies and clients
        """
        self.data_loading.emit(False)
        if not isinstance(result, tuple) or len(result) != 4:
            self.operation_error.emit(_("Invalid response type"))
            return

        tasks, deals, policies, clients = result
        if not isinstance(tasks, list) or not isinstance(deals, list) or not isinstance(policies, list) or not isinstance(clients, list):
            self.operation_error.emit(_("Invalid response type"))
            return

        self._tasks = tasks
        self._deals = deals
        self._policies = policies
        self._clients = clients

        self._context.update_tasks(tasks)
        self._context.update_deals(deals)
        self._context.update_policies(policies)
        self._context.update_clients(clients)
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
            self._tasks = cached_tasks
            self._deals = list(self._context.cache.deals.values())
            self._policies = list(self._context.cache.policies.values())
            self._clients = list(self._context.cache.clients.values())
            self.populate(self._to_rows(cached_tasks))
            self.operation_error.emit(_("Showing cached data (network error: {})").format(error_message))
        else:
            # No cache available
            self.operation_error.emit(error_message)

    def on_add(self) -> None:
        """Create a new task."""
        dialog = TaskDialog(
            context=self._context,
            clients=self._clients,
            deals=self._deals,
            policies=self._policies,
            status_options=self._collect_status_options(),
            parent=self,
        )
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        payload = dialog.payload()
        if payload is None:
            return

        self.data_loading.emit(True)

        def create_task_task() -> Task:
            return self._context.api.create_task(payload)

        worker = Worker(create_task_task)
        worker.finished.connect(self._on_task_created)  # type: ignore[arg-type]
        worker.error.connect(self._on_task_operation_error)  # type: ignore[arg-type]
        self._worker_pool.start("create_task", worker)

    def on_edit(self, index: int, row: Sequence[str]) -> None:
        """Edit selected task."""
        if index < 0 or index >= len(self._tasks):
            self.operation_error.emit(_("Task not found in current selection."))
            return

        task = self._tasks[index]
        dialog = TaskDialog(
            context=self._context,
            clients=self._clients,
            deals=self._deals,
            policies=self._policies,
            status_options=self._collect_status_options(),
            parent=self,
            task=task,
        )
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        changes = dialog.update_payload(task)
        if not changes:
            return

        self.data_loading.emit(True)

        def update_task_task() -> Task:
            return self._context.api.update_task(task.id, changes)

        worker = Worker(update_task_task)
        worker.finished.connect(self._on_task_updated)  # type: ignore[arg-type]
        worker.error.connect(self._on_task_operation_error)  # type: ignore[arg-type]
        self._worker_pool.start("update_task", worker)

    def on_delete(self, index: int, row: Sequence[str]) -> None:
        """Handle delete task action.

        Args:
            index: Row index in table
            row: Row values from table
        """
        if index < 0 or index >= len(self._tasks):
            self.operation_error.emit(_("Task not found in current selection."))
            return

        task = self._tasks[index]
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

    def _collect_status_options(self) -> list[str]:
        return sorted({task.status_code for task in self._tasks if task.status_code})

    def _on_task_created(self, new_task: Any) -> None:
        self.data_loading.emit(False)
        if not isinstance(new_task, Task):
            self.operation_error.emit(_("Invalid response type"))
            return
        self.load_data()
        QMessageBox.information(self, _("Success"), _("Task created."))

    def _on_task_updated(self, updated_task: Any) -> None:
        self.data_loading.emit(False)
        if not isinstance(updated_task, Task):
            self.operation_error.emit(_("Invalid response type"))
            return
        self.load_data()
        QMessageBox.information(self, _("Success"), _("Task updated."))

    def _on_task_operation_error(self, error_message: str) -> None:
        self.data_loading.emit(False)
        self.operation_error.emit(_("Failed to process task: {}").format(error_message))

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
