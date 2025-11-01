from __future__ import annotations

import logging
from typing import Any, Sequence

from PySide6.QtWidgets import QMessageBox

from api.client import APIClientError
from core.app_context import AppContext
from models import Payment, Policy
from ui.base_table import BaseTableTab
from ui.worker import Worker, WorkerPool

logger = logging.getLogger(__name__)


def _format_money(value: float | None) -> str:
    if value is None:
        return ""
    return f"{value:,.2f}"


class FinanceTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=[
                "Deal",
                "Policy",
                "Seq",
                "Status",
                "Date",
                "Planned",
                "Incomes",
                "Expenses",
                "Net",
            ],
            title="Finance",
            parent=parent,
            enable_add=False,
            enable_edit=False,
            enable_delete=False,
        )
        self._context = context
        self._worker_pool = WorkerPool()

    def load_data(self) -> None:
        """Load payments from API in background thread."""
        if self._worker_pool.is_running("load_payments"):
            logger.debug("Payments load already in progress")
            return

        self.data_loading.emit(True)

        def load_payments_task() -> tuple[list[Policy], list[Payment]]:
            policies = self._context.api.fetch_policies()
            payments = self._context.api.fetch_payments_for_policies(policies)
            return policies, payments

        worker = Worker(load_payments_task)
        worker.finished.connect(self._on_payments_loaded)  # type: ignore[arg-type]
        worker.error.connect(self._on_load_error)  # type: ignore[arg-type]
        self._worker_pool.start("load_payments", worker)

    def _on_payments_loaded(self, result: Any) -> None:
        """Handle successful payments load.

        Args:
            result: Tuple of (policies, payments) from API
        """
        self.data_loading.emit(False)
        if not isinstance(result, tuple) or len(result) != 2:
            self.operation_error.emit("Invalid response type")
            return

        policies, payments = result
        if not isinstance(payments, list):
            self.operation_error.emit("Invalid response type")
            return

        self._context.update_policies(policies)
        self.populate(self._to_rows(payments))

    def _on_load_error(self, error_message: str) -> None:
        """Handle load error.

        Args:
            error_message: Error description
        """
        self.data_loading.emit(False)

        # Try to show cached data if available
        # For finance tab, we show cached policies and their payments
        cached_policies = list(self._context.cache.policies.values())
        if cached_policies:
            logger.warning("API error, showing cached data: %s", error_message)
            # Create empty payments list for cached display (just show policies)
            self.populate(self._to_rows([]))
            self.operation_error.emit(f"Showing cached data (network error: {error_message})")
        else:
            # No cache available
            self.operation_error.emit(error_message)

    def _to_rows(self, payments: list[Payment]):
        for payment in payments:
            policy_number = self._context.get_policy_number(payment.policy_id)
            deal_title = self._context.get_deal_title(payment.deal_id)
            yield (
                deal_title,
                policy_number,
                str(payment.sequence),
                payment.status or "",
                payment.planned_date.isoformat() if payment.planned_date else "",
                _format_money(payment.planned_amount),
                _format_money(payment.incomes_total),
                _format_money(payment.expenses_total),
                _format_money(payment.net_total),
            )
