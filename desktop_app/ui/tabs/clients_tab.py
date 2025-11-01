from __future__ import annotations

from typing import Sequence

from PySide6.QtWidgets import QDialog, QMessageBox

from api.client import APIClientError
from core.app_context import AppContext
from models import Client
from ui.base_table import BaseTableTab
from ui.dialogs.client_dialog import ClientDialog


class ClientsTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=["Name", "Email", "Phone", "Status", "Created", "Updated"],
            title="Clients",
            parent=parent,
        )
        self._context = context
        self._clients: list[Client] = []

    def load_data(self) -> None:
        try:
            clients = self._context.api.fetch_clients()
        except APIClientError as exc:
            QMessageBox.warning(self, "Load error", str(exc))
            return

        self._clients = clients
        self._context.update_clients(clients)
        self.populate(self._to_rows(clients))

    def on_add(self) -> None:
        dialog = ClientDialog(parent=self)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        try:
            client = self._context.api.create_client(dialog.payload())
        except APIClientError as exc:
            QMessageBox.critical(self, "Create client", str(exc))
            return

        self._context.update_clients([client])
        self.load_data()
        QMessageBox.information(self, "Create client", "Client successfully created.")

    def on_edit(self, index: int, row: Sequence[str]) -> None:
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

        try:
            updated = self._context.api.update_client(client.id, changes)  # type: ignore[arg-type]
        except APIClientError as exc:
            QMessageBox.critical(self, "Edit client", str(exc))
            return

        self._context.update_clients([updated])
        self.load_data()
        QMessageBox.information(self, "Edit client", "Client data updated.")

    def on_delete(self, index: int, row: Sequence[str]) -> None:
        client = self._clients[index]
        confirmation = QMessageBox.question(
            self,
            "Delete client",
            f"Delete client \"{client.name}\"?",
            QMessageBox.Yes | QMessageBox.No,
        )
        if confirmation != QMessageBox.Yes:
            return

        try:
            self._context.api.delete_client(client.id)
        except APIClientError as exc:
            QMessageBox.critical(self, "Delete client", str(exc))
            return

        self._context.cache.clients.pop(client.id, None)
        self.load_data()
        QMessageBox.information(self, "Delete client", "Client removed.")

    @staticmethod
    def _to_rows(clients: list[Client]):
        for client in clients:
            yield (
                client.name,
                client.email or "",
                client.phone or "",
                client.status or "",
                client.created_at.strftime("%Y-%m-%d %H:%M") if client.created_at else "",
                client.updated_at.strftime("%Y-%m-%d %H:%M") if client.updated_at else "",
            )
