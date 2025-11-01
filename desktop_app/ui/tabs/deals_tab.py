from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Sequence

from PySide6.QtWidgets import QMessageBox, QDialog

from api.client import APIClientError
from core.app_context import AppContext
from models import Client, Deal
from ui.base_table import BaseTableTab
from ui.dialogs.deal_dialog import DealDialog
from ui.worker import Worker, WorkerPool

logger = logging.getLogger(__name__)


class DealsTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=["ID", "Title", "Description", "Client", "Status", "Stage", "Next review", "Owner ID", "Created", "Updated"],
            title="Deals",
            parent=parent,
        )
        self._context = context
        self._deals: list[Deal] = []
        self._clients: list[Client] = []
        self._worker_pool = WorkerPool()

    def load_data(self) -> None:
        """Load deals and clients from API in background thread."""
        if self._worker_pool.is_running("load_deals"):
            logger.debug("Deals load already in progress")
            return

        self.data_loading.emit(True)

        def load_deals_task() -> tuple[list[Deal], list[Client]]:
            deals = self._context.api.fetch_deals()
            clients = self._context.api.fetch_clients()
            return deals, clients

        worker = Worker(load_deals_task)
        worker.finished.connect(self._on_deals_loaded)  # type: ignore[arg-type]
        worker.error.connect(self._on_load_error)  # type: ignore[arg-type]
        self._worker_pool.start("load_deals", worker)

    def _on_deals_loaded(self, result: Any) -> None:
        """Handle successful deals load.

        Args:
            result: Tuple of (deals, clients) from API
        """
        self.data_loading.emit(False)
        if not isinstance(result, tuple) or len(result) != 2:
            self.operation_error.emit("Invalid response type")
            return

        deals, clients = result
        if not isinstance(deals, list) or not isinstance(clients, list):
            self.operation_error.emit("Invalid response types")
            return

        self._deals = deals
        self._clients = clients
        self._context.update_deals(deals)
        self._context.update_clients(clients)
        self.populate(self._to_rows(deals))

    def _on_load_error(self, error_message: str) -> None:
        """Handle load error.

        Args:
            error_message: Error description
        """
        self.data_loading.emit(False)

        # Try to show cached data if available
        cached_deals = list(self._context.cache.deals.values())
        if cached_deals:
            logger.warning("API error, showing cached data: %s", error_message)
            self._deals = cached_deals
            self.populate(self._to_rows(cached_deals))
            self.operation_error.emit(f"Showing cached data (network error: {error_message})")
        else:
            # No cache available
            self.operation_error.emit(error_message)

    def on_add(self) -> None:
        """Handle add deal action."""
        if not self._clients:
            QMessageBox.warning(self, "Create deal", "Create a client first.")
            return

        dialog = DealDialog(parent=self, context=self._context, clients=self._clients)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        self.data_loading.emit(True)

        def create_deal_task() -> Deal:
            payload = dialog.payload()
            return self._context.api.create_deal(payload)

        worker = Worker(create_deal_task)
        worker.finished.connect(self._on_deal_created)  # type: ignore[arg-type]
        worker.error.connect(self._on_create_error)  # type: ignore[arg-type]
        self._worker_pool.start("create_deal", worker)

    def _on_deal_created(self, deal: Any) -> None:
        """Handle successful deal creation.

        Args:
            deal: Created Deal object
        """
        self.data_loading.emit(False)
        if not isinstance(deal, Deal):
            self.operation_error.emit("Invalid response type")
            return

        self._context.update_deals([deal])
        self.load_data()
        QMessageBox.information(self, "Success", "Deal successfully created.")

    def _on_create_error(self, error_message: str) -> None:
        """Handle deal creation error.

        Args:
            error_message: Error description
        """
        self.data_loading.emit(False)
        self.operation_error.emit(f"Failed to create deal: {error_message}")

    def on_edit(self, index: int, row: Sequence[str]) -> None:
        """Handle edit deal action.

        Args:
            index: Row index in table
            row: Row values from table
        """
        deal = self._deals[index]
        dialog = DealDialog(parent=self, context=self._context, clients=self._clients, deal=deal)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        changes = dialog.update_payload(deal)
        if not changes:
            return

        self.data_loading.emit(True)

        def update_deal_task() -> Deal:
            return self._context.api.update_deal(deal.id, changes)  # type: ignore[arg-type]

        worker = Worker(update_deal_task)
        worker.finished.connect(self._on_deal_updated)  # type: ignore[arg-type]
        worker.error.connect(self._on_update_error)  # type: ignore[arg-type]
        self._worker_pool.start("update_deal", worker)

    def _on_deal_updated(self, updated_deal: Any) -> None:
        """Handle successful deal update.

        Args:
            updated_deal: Updated Deal object
        """
        self.data_loading.emit(False)
        if not isinstance(updated_deal, Deal):
            self.operation_error.emit("Invalid response type")
            return

        self._context.update_deals([updated_deal])
        self.load_data()
        QMessageBox.information(self, "Success", "Deal updated.")

    def _on_update_error(self, error_message: str) -> None:
        """Handle deal update error.

        Args:
            error_message: Error description
        """
        self.data_loading.emit(False)
        self.operation_error.emit(f"Failed to update deal: {error_message}")

    def on_delete(self, index: int, row: Sequence[str]) -> None:
        """Handle delete deal action.

        Args:
            index: Row index in table
            row: Row values from table
        """
        deal = self._deals[index]
        confirmation = QMessageBox.question(
            self,
            "Delete deal",
            f"Delete deal \"{deal.title}\"?",
            QMessageBox.Yes | QMessageBox.No,
        )
        if confirmation != QMessageBox.Yes:
            return

        self.data_loading.emit(True)

        def delete_deal_task() -> None:
            self._context.api.delete_deal(deal.id)

        worker = Worker(delete_deal_task)
        worker.finished.connect(self._on_deal_deleted)  # type: ignore[arg-type]
        worker.error.connect(self._on_delete_error)  # type: ignore[arg-type]
        self._worker_pool.start("delete_deal", worker)

    def _on_deal_deleted(self, result: Any) -> None:
        """Handle successful deal deletion.

        Args:
            result: Result from API (usually None)
        """
        self.data_loading.emit(False)
        self.load_data()
        QMessageBox.information(self, "Success", "Deal removed.")

    def _on_delete_error(self, error_message: str) -> None:
        """Handle deal deletion error.

        Args:
            error_message: Error description
        """
        self.data_loading.emit(False)
        self.operation_error.emit(f"Failed to delete deal: {error_message}")

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
            updated = (
                deal.updated_at.strftime("%Y-%m-%d %H:%M") if isinstance(deal.updated_at, datetime) else ""
            )
            yield (
                str(deal.id),
                deal.title,
                deal.description or "",
                client_name,
                deal.status or "",
                deal.stage or "",
                next_review,
                str(deal.owner_id) if deal.owner_id else "",
                created,
                updated,
            )
