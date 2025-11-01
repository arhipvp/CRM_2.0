from __future__ import annotations

from datetime import datetime
from typing import Sequence

from PySide6.QtWidgets import QMessageBox, QDialog, QDialog

from api.client import APIClientError
from core.app_context import AppContext
from models import Client, Deal
from ui.base_table import BaseTableTab
from ui.dialogs.deal_dialog import DealDialog


class DealsTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=["Title", "Client", "Status", "Next review", "Created"],
            title="Deals",
            parent=parent,
        )
        self._context = context
        self._deals: list[Deal] = []
        self._clients: list[Client] = []

    def load_data(self) -> None:
        try:
            deals = self._context.api.fetch_deals()
            clients = self._context.api.fetch_clients()
        except APIClientError as exc:
            QMessageBox.warning(self, "Load error", str(exc))
            return

        self._deals = deals
        self._clients = clients
        self._context.update_deals(deals)
        self._context.update_clients(clients)
        self.populate(self._to_rows(deals))

    def on_add(self) -> None:
        if not self._clients:
            QMessageBox.warning(self, "Create deal", "Create a client first.")
            return

        dialog = DealDialog(parent=self, context=self._context, clients=self._clients)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        payload = dialog.payload()
        try:
            deal = self._context.api.create_deal(payload)
        except APIClientError as exc:
            QMessageBox.critical(self, "Create deal", str(exc))
            return

        self._context.update_deals([deal])
        self.load_data()
        QMessageBox.information(self, "Create deal", "Deal successfully created.")

    def on_edit(self, index: int, row: Sequence[str]) -> None:
        deal = self._deals[index]
        dialog = DealDialog(parent=self, context=self._context, clients=self._clients, deal=deal)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        changes = dialog.update_payload(deal)
        if not changes:
            return

        try:
            updated = self._context.api.update_deal(deal.id, changes)  # type: ignore[arg-type]
        except APIClientError as exc:
            QMessageBox.critical(self, "Edit deal", str(exc))
            return

        self._context.update_deals([updated])
        self.load_data()
        QMessageBox.information(self, "Edit deal", "Deal updated.")

    def on_delete(self, index: int, row: Sequence[str]) -> None:
        deal = self._deals[index]
        confirmation = QMessageBox.question(
            self,
            "Delete deal",
            f"Delete deal \"{deal.title}\"?",
            QMessageBox.Yes | QMessageBox.No,
        )
        if confirmation != QMessageBox.Yes:
            return

        try:
            self._context.api.delete_deal(deal.id)
        except APIClientError as exc:
            QMessageBox.critical(self, "Delete deal", str(exc))
            return

        self._context.cache.deals.pop(deal.id, None)
        self.load_data()
        QMessageBox.information(self, "Delete deal", "Deal removed.")

    def _to_rows(self, deals: list[Deal]):
        for deal in deals:
            client_name = self._context.get_client_name(deal.client_id)
            next_review = (
                deal.next_review_at.isoformat()
                if deal.next_review_at
                else ""
            )
            created = (
                deal.created_at.strftime("%Y-%m-%d %H:%M") if isinstance(deal.created_at, datetime) else ""
            )
            yield (
                deal.title,
                client_name,
                deal.status or "",
                next_review,
                created,
            )

