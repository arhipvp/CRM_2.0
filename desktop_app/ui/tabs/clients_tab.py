from __future__ import annotations

import logging
from typing import Any, Sequence

from uuid import UUID

from PySide6.QtWidgets import QDialog, QMessageBox

from api.client import APIClientError
from core.app_context import AppContext
from models import Client
from ui.base_table import BaseTableTab
from ui.dialogs.client_dialog import ClientDialog
from ui.worker import Worker, WorkerPool
from i18n import _

logger = logging.getLogger(__name__)


class ClientsTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=[_("ID"), _("Name"), _("Email"), _("Phone"), _("Status"), _("Owner ID"), _("Created"), _("Updated"), _("Deleted")],
            title=_("Clients"),
            parent=parent,
        )
        self._context = context
        self._clients: list[Client] = []
        self._worker_pool = WorkerPool()

    def load_data(self) -> None:
        """Load clients from API in background thread."""
        if self._worker_pool.is_running("load_clients"):
            logger.debug("Clients load already in progress")
            return

        self.data_loading.emit(True)

        worker = Worker(self._context.api.fetch_clients)
        worker.finished.connect(self._on_clients_loaded)  # type: ignore[arg-type]
        worker.error.connect(self._on_load_error)  # type: ignore[arg-type]
        self._worker_pool.start("load_clients", worker)

    def _on_clients_loaded(self, clients: Any) -> None:
        """Handle successful clients load.

        Args:
            clients: List of Client objects from API
        """
        self.data_loading.emit(False)
        if not isinstance(clients, list):
            self.operation_error.emit(_("Invalid response type"))
            return

        self._clients = clients
        self._context.update_clients(clients)
        self.populate(self._to_rows(clients))

    def _on_load_error(self, error_message: str) -> None:
        """Handle load error.

        Args:
            error_message: Error description
        """
        self.data_loading.emit(False)

        # Try to show cached data if available
        cached_clients = list(self._context.cache.clients.values())
        if cached_clients:
            logger.warning("API error, showing cached data: %s", error_message)
            self._clients = cached_clients
            self.populate(self._to_rows(cached_clients))
            self.operation_error.emit(_("Showing cached data (network error: {})").format(error_message))
        else:
            # No cache available
            self.operation_error.emit(error_message)

    def on_add(self) -> None:
        """Handle add client action."""
        dialog = ClientDialog(parent=self)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        self.data_loading.emit(True)

        def create_client_task() -> Client:
            return self._context.api.create_client(dialog.payload())

        worker = Worker(create_client_task)
        worker.finished.connect(self._on_client_created)  # type: ignore[arg-type]
        worker.error.connect(self._on_create_error)  # type: ignore[arg-type]
        self._worker_pool.start("create_client", worker)

    def _on_client_created(self, client: Any) -> None:
        """Handle successful client creation.

        Args:
            client: Created Client object
        """
        self.data_loading.emit(False)
        if not isinstance(client, Client):
            self.operation_error.emit(_("Invalid response type"))
            return

        self._context.update_clients([client])
        self.load_data()
        QMessageBox.information(self, _("Success"), _("Client successfully created."))

    def _on_create_error(self, error_message: str) -> None:
        """Handle client creation error.

        Args:
            error_message: Error description
        """
        self.data_loading.emit(False)
        self.operation_error.emit(_("Failed to create client: {}").format(error_message))

    def on_edit(self, index: int, row: Sequence[str]) -> None:
        """Handle edit client action.

        Args:
            index: Row index in table
            row: Row values from table
        """
        client = self._clients[index]
        dialog = ClientDialog(parent=self, client=client)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        new_values = dialog.payload()
        changes: dict[str, object] = {}
        if new_values["name"] != client.name:
            changes["name"] = new_values["name"]
        if (new_values["email"] or None) != client.email:
            changes["email"] = new_values["email"]
        if (new_values["phone"] or None) != client.phone:
            changes["phone"] = new_values["phone"]
        if (new_values["status"] or "active") != (client.status or "active"):
            changes["status"] = new_values["status"]

        if not changes:
            return

        self.data_loading.emit(True)

        def update_client_task() -> Client:
            return self._context.api.update_client(client.id, changes)  # type: ignore[arg-type]

        worker = Worker(update_client_task)
        worker.finished.connect(self._on_client_updated)  # type: ignore[arg-type]
        worker.error.connect(self._on_update_error)  # type: ignore[arg-type]
        self._worker_pool.start("update_client", worker)

    def _on_client_updated(self, updated_client: Any) -> None:
        """Handle successful client update.

        Args:
            updated_client: Updated Client object
        """
        self.data_loading.emit(False)
        if not isinstance(updated_client, Client):
            self.operation_error.emit(_("Invalid response type"))
            return

        self._context.update_clients([updated_client])
        self.load_data()
        QMessageBox.information(self, _("Success"), _("Client data updated."))

    def _on_update_error(self, error_message: str) -> None:
        """Handle client update error.

        Args:
            error_message: Error description
        """
        self.data_loading.emit(False)
        self.operation_error.emit(_("Failed to update client: {}").format(error_message))

        client = self._context.cache.clients[UUID(row[0])]
        confirmation = QMessageBox.question(
            self,
            _("Delete client"),
            _("Delete client \"{}\"?").format(client.name),
            QMessageBox.Yes | QMessageBox.No,
        )
        if confirmation != QMessageBox.Yes:
            return

        self.data_loading.emit(True)

        def delete_client_task() -> None:
            self._context.api.delete_client(client.id)

        worker = Worker(delete_client_task)
        worker.finished.connect(self._on_client_deleted)  # type: ignore[arg-type]
        worker.error.connect(self._on_delete_error)  # type: ignore[arg-type]
        self._worker_pool.start("delete_client", worker)

    def _on_client_deleted(self, result: Any) -> None:
        """Handle successful client deletion.

        Args:
            result: Result from API (usually None)
        """
        self.data_loading.emit(False)
        # Note: Store client_id before deletion for cache cleanup
        # This is handled by storing client_id in the task
        self.load_data()
        QMessageBox.information(self, _("Success"), _("Client removed."))

    def _on_delete_error(self, error_message: str) -> None:
        """Handle client deletion error.

        Args:
            error_message: Error description
        """
        self.data_loading.emit(False)
        self.operation_error.emit(_("Failed to delete client: {}").format(error_message))

    @staticmethod
    def _to_rows(clients: list[Client]):
        for client in clients:
            yield (
                str(client.id),
                client.name,
                client.email or "",
                client.phone or "",
                client.status or "",
                str(client.owner_id) if client.owner_id else "",
                client.created_at.strftime("%Y-%m-%d %H:%M") if client.created_at else "",
                client.updated_at.strftime("%Y-%m-%d %H:%M") if client.updated_at else "",
                _("Yes") if client.is_deleted else _("No"),
            )
