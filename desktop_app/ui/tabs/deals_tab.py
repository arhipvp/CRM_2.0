from __future__ import annotations

from PySide6.QtWidgets import QMessageBox

from api.client import APIClientError
from core.app_context import AppContext
from models import Deal
from ui.base_table import BaseTableTab


class DealsTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=["Название", "Клиент", "Статус", "Этап", "След. контакт", "Создан"],
            title="Сделки",
            parent=parent,
        )
        self._context = context

    def load_data(self) -> None:
        try:
            deals = self._context.api.fetch_deals()
            clients = self._context.api.fetch_clients()
        except APIClientError as exc:
            QMessageBox.warning(self, "Ошибка загрузки", str(exc))
            return

        self._context.update_deals(deals)
        self._context.update_clients(clients)

        self.populate(self._to_rows(deals))

    def _to_rows(self, deals: list[Deal]):
        for deal in deals:
            client_name = self._context.get_client_name(deal.client_id)
            yield (
                deal.title,
                client_name,
                deal.status or "",
                deal.stage or "",
                deal.next_review_at.isoformat() if deal.next_review_at else "",
                deal.created_at.strftime("%Y-%m-%d %H:%M") if deal.created_at else "",
            )

