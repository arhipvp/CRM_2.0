from __future__ import annotations

import logging
from typing import Any, Sequence

from PySide6.QtWidgets import QDialog, QMessageBox

from api.client import APIClientError
from core.app_context import AppContext
from models import Deal, Payment, Policy
from ui.base_table import BaseTableTab
from ui.dialogs.payment_dialog import PaymentDialog
from ui.worker import Worker, WorkerPool
from i18n import _

logger = logging.getLogger(__name__)


def _format_money(value: float | None) -> str:
    if value is None:
        return ""
    return f"{value:,.2f}"


class FinanceTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=[
                _("ID"),
                _("Deal"),
                _("Policy"),
                _("Seq"),
                _("Status"),
                _("Planned Date"),
                _("Actual Date"),
                _("Planned Amount"),
                _("Currency"),
                _("Comment"),
                _("Incomes"),
                _("Expenses"),
                _("Net"),
            ],
            title=_("Finance"),
            parent=parent,
            enable_add=True,
            enable_edit=True,
            enable_delete=True,
        )
        self._context = context
        self._worker_pool = WorkerPool()
        self._policies: list[Policy] = []
        self._payments: list[Payment] = []
        self._deals: list[Deal] = []

    def load_data(self) -> None:
        """Load payments from API in background thread."""
        if self._worker_pool.is_running("load_payments"):
            logger.debug("Payments load already in progress")
            return

        self.data_loading.emit(True)

        def load_payments_task() -> tuple[list[Policy], list[Deal], list[Payment]]:
            policies = self._context.api.fetch_policies()
            deals = self._context.api.fetch_deals()
            payments = self._context.api.fetch_payments_for_policies(policies)
            return policies, deals, payments

        worker = Worker(load_payments_task)
        worker.finished.connect(self._on_payments_loaded)  # type: ignore[arg-type]
        worker.error.connect(self._on_load_error)  # type: ignore[arg-type]
        self._worker_pool.start("load_payments", worker)

    def _on_payments_loaded(self, result: Any) -> None:
        """Handle successful payments load.

        Args:
            result: Tuple of (policies, deals, payments) from API
        """
        self.data_loading.emit(False)
        if not isinstance(result, tuple) or len(result) != 3:
            self.operation_error.emit(_("Invalid response type"))
            return

        policies, deals, payments = result
        if not isinstance(policies, list) or not isinstance(deals, list) or not isinstance(payments, list):
            self.operation_error.emit(_("Invalid response type"))
            return

        self._policies = policies
        self._deals = deals
        self._payments = payments

        self._context.update_policies(policies)
        self._context.update_deals(deals)
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
            self._policies = cached_policies
            self._deals = list(self._context.cache.deals.values())
            self._payments = []
            self.populate(self._to_rows([]))
            self.operation_error.emit(_("Showing cached data (network error: {})").format(error_message))
        else:
            # No cache available
            self.operation_error.emit(error_message)

    def on_add(self) -> None:
        """Create a new payment."""
        if not self._policies:
            QMessageBox.warning(self, _("Создание платежа"), _("Нет доступных полисов для создания платежа."))
            return

        dialog = PaymentDialog(
            context=self._context,
            policies=self._policies,
            deals=self._deals,
            status_options=self._collect_status_options(),
            parent=self,
        )
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        payload_info = dialog.create_payload()
        if payload_info is None:
            return

        deal_id, policy_id, payload = payload_info
        self.data_loading.emit(True)

        def create_payment_task() -> Payment:
            return self._context.api.create_payment(deal_id, policy_id, payload)

        worker = Worker(create_payment_task)
        worker.finished.connect(self._on_payment_created)  # type: ignore[arg-type]
        worker.error.connect(self._on_payment_operation_error)  # type: ignore[arg-type]
        self._worker_pool.start("create_payment", worker)

    def on_edit(self, index: int, row: Sequence[str]) -> None:
        """Edit selected payment."""
        if index < 0 or index >= len(self._payments):
            self.operation_error.emit(_("Payment not found in current selection."))
            return

        payment = self._payments[index]
        if payment.deal_id is None or payment.policy_id is None:
            self.operation_error.emit(_("Payment is missing linked deal or policy."))
            return
        dialog = PaymentDialog(
            context=self._context,
            policies=self._policies,
            deals=self._deals,
            status_options=self._collect_status_options(),
            parent=self,
            payment=payment,
        )
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        changes = dialog.update_payload(payment)
        if not changes:
            return

        self.data_loading.emit(True)

        def update_payment_task() -> Payment:
            return self._context.api.update_payment(payment.deal_id, payment.policy_id, payment.id, changes)

        worker = Worker(update_payment_task)
        worker.finished.connect(self._on_payment_updated)  # type: ignore[arg-type]
        worker.error.connect(self._on_payment_operation_error)  # type: ignore[arg-type]
        self._worker_pool.start("update_payment", worker)

    def on_delete(self, index: int, row: Sequence[str]) -> None:
        """Delete selected payment."""
        if index < 0 or index >= len(self._payments):
            self.operation_error.emit(_("Payment not found in current selection."))
            return

        payment = self._payments[index]
        if payment.deal_id is None or payment.policy_id is None:
            self.operation_error.emit(_("Payment is missing linked deal or policy."))
            return
        confirmation = QMessageBox.question(
            self,
            _("Удаление платежа"),
            _("Удалить платёж №{}?").format(payment.sequence),
            QMessageBox.Yes | QMessageBox.No,
        )
        if confirmation != QMessageBox.Yes:
            return

        self.data_loading.emit(True)

        def delete_payment_task() -> None:
            self._context.api.delete_payment(payment.deal_id, payment.policy_id, payment.id)

        worker = Worker(delete_payment_task)
        worker.finished.connect(self._on_payment_deleted)  # type: ignore[arg-type]
        worker.error.connect(self._on_payment_operation_error)  # type: ignore[arg-type]
        self._worker_pool.start("delete_payment", worker)

    def _collect_status_options(self) -> list[str]:
        return sorted({payment.status for payment in self._payments if payment.status})

    def _on_payment_created(self, new_payment: Any) -> None:
        self.data_loading.emit(False)
        if not isinstance(new_payment, Payment):
            self.operation_error.emit(_("Invalid response type"))
            return
        self.load_data()
        QMessageBox.information(self, _("Success"), _("Payment created."))

    def _on_payment_updated(self, updated_payment: Any) -> None:
        self.data_loading.emit(False)
        if not isinstance(updated_payment, Payment):
            self.operation_error.emit(_("Invalid response type"))
            return
        self.load_data()
        QMessageBox.information(self, _("Success"), _("Payment updated."))

    def _on_payment_deleted(self, result: Any) -> None:
        self.data_loading.emit(False)
        self.load_data()
        QMessageBox.information(self, _("Success"), _("Payment removed."))

    def _on_payment_operation_error(self, error_message: str) -> None:
        self.data_loading.emit(False)
        self.operation_error.emit(_("Failed to process payment: {}").format(error_message))

    def _to_rows(self, payments: list[Payment]):
        for payment in payments:
            policy_number = self._context.get_policy_number(payment.policy_id)
            deal_title = self._context.get_deal_title(payment.deal_id)
            yield (
                str(payment.id),
                deal_title,
                policy_number,
                str(payment.sequence),
                payment.status or "",
                payment.planned_date.isoformat() if payment.planned_date else "",
                payment.actual_date.isoformat() if payment.actual_date else "",
                _format_money(payment.planned_amount),
                payment.currency or "",
                payment.comment or "",
                _format_money(payment.incomes_total),
                _format_money(payment.expenses_total),
                _format_money(payment.net_total),
            )
