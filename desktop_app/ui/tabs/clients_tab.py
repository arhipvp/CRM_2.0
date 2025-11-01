from __future__ import annotations

from PySide6.QtWidgets import QMessageBox

from api.client import APIClientError
from core.app_context import AppContext
from models import Client
from ui.base_table import BaseTableTab


class ClientsTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=["Название", "Email", "Телефон", "Статус", "Создан", "Обновлён"],
            title="Клиенты",
            parent=parent,
        )
        self._context = context

    def load_data(self) -> None:
        try:
            clients = self._context.api.fetch_clients()
        except APIClientError as exc:
            QMessageBox.warning(self, "Ошибка загрузки", str(exc))
            return

        self._context.update_clients(clients)
        self.populate(self._to_rows(clients))

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
