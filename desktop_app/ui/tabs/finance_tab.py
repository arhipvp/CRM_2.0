from __future__ import annotations

from PySide6.QtWidgets import QMessageBox

from api.client import APIClientError
from core.app_context import AppContext
from models import Payment
from ui.base_table import BaseTableTab


def _format_money(value: float | None) -> str:
    if value is None:
        return ""
    return f"{value:,.2f}".replace(",", " ")


class FinanceTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=[
                "Сделка",
                "Полис",
                "Очередь",
                "Статус",
                "Дата",
                "План",
                "Доход",
                "Расход",
                "Итого",
            ],
            title="Финансы",
            parent=parent,
        )
        self._context = context

    def load_data(self) -> None:
        try:
            policies = self._context.api.fetch_policies()
            payments = self._context.api.fetch_payments_for_policies(policies)
        except APIClientError as exc:
            QMessageBox.warning(self, "Ошибка загрузки", str(exc))
            return

        self._context.update_policies(policies)
        self.populate(self._to_rows(payments))

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
