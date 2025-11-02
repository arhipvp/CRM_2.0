from __future__ import annotations

from datetime import date, datetime
from typing import Iterable, Sequence
from uuid import UUID

from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QDoubleSpinBox,
    QFormLayout,
    QLineEdit,
    QMessageBox,
    QPlainTextEdit,
)

from core.app_context import AppContext
from models import Deal, Payment, Policy
from i18n import _


def _parse_date(text: str) -> date | None:
    if not text:
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        return None


class PaymentDialog(QDialog):
    """Dialog for creating or editing payments."""

    DEFAULT_CURRENCY = "RUB"

    def __init__(
        self,
        *,
        context: AppContext,
        policies: Iterable[Policy],
        deals: Iterable[Deal],
        status_options: Sequence[str] | None = None,
        parent=None,
        payment: Payment | None = None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle(_("Новый платёж") if payment is None else _("Редактирование платежа"))
        self._context = context
        self._payment = payment
        self._policies = list(policies)
        self._deals = {deal.id: deal for deal in deals}

        self.policy_combo = QComboBox(self)
        self.policy_combo.addItem(_("Выберите полис"), None)
        for policy in self._policies:
            deal_title = context.get_deal_title(policy.deal_id)
            label = f"{policy.policy_number} ({deal_title})" if deal_title else policy.policy_number
            self.policy_combo.addItem(label, policy.id)

        self.status_combo = QComboBox(self)
        self.status_combo.setEditable(True)
        statuses = [status for status in (status_options or []) if status]
        if payment and payment.status and payment.status not in statuses:
            statuses.insert(0, payment.status)
        for status in statuses:
            self.status_combo.addItem(status)

        self.amount_spin = QDoubleSpinBox(self)
        self.amount_spin.setDecimals(2)
        self.amount_spin.setMaximum(1_000_000_000)
        self.amount_spin.setMinimum(0.00)

        self.currency_edit = QLineEdit(self)
        self.currency_edit.setMaxLength(12)
        self.currency_edit.setPlaceholderText(_("Трёхбуквенный код валюты"))

        self.planned_date_edit = QLineEdit(self)
        self.planned_date_edit.setPlaceholderText(_("ГГГГ-ММ-ДД"))

        self.actual_date_edit = QLineEdit(self)
        self.actual_date_edit.setPlaceholderText(_("ГГГГ-ММ-ДД"))

        self.comment_edit = QPlainTextEdit(self)

        form = QFormLayout(self)
        form.addRow(_("Полис *"), self.policy_combo)
        form.addRow(_("Статус"), self.status_combo)
        form.addRow(_("Плановая дата"), self.planned_date_edit)
        form.addRow(_("Фактическая дата"), self.actual_date_edit)
        form.addRow(_("Сумма *"), self.amount_spin)
        form.addRow(_("Валюта *"), self.currency_edit)
        form.addRow(_("Комментарий"), self.comment_edit)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, parent=self)
        buttons.accepted.connect(self._on_accept)  # type: ignore[arg-type]
        buttons.rejected.connect(self.reject)  # type: ignore[arg-type]
        form.addRow(buttons)

        if payment is not None:
            policy_index = self.policy_combo.findData(payment.policy_id)
            if policy_index >= 0:
                self.policy_combo.setCurrentIndex(policy_index)
            self.policy_combo.setEnabled(False)

            if payment.status:
                status_index = self.status_combo.findText(payment.status)
                if status_index >= 0:
                    self.status_combo.setCurrentIndex(status_index)
                else:
                    self.status_combo.setEditText(payment.status)
            self.amount_spin.setValue(float(payment.planned_amount or 0))
            if payment.currency:
                self.currency_edit.setText(payment.currency)
            if payment.planned_date:
                self.planned_date_edit.setText(payment.planned_date.isoformat())
            if payment.actual_date:
                self.actual_date_edit.setText(payment.actual_date.isoformat())
            if payment.comment:
                self.comment_edit.setPlainText(payment.comment)
        else:
            self.currency_edit.setText(self.DEFAULT_CURRENCY)

    def create_payload(self) -> tuple[UUID, UUID, dict[str, object]] | None:
        policy_id = self.policy_combo.currentData()
        if policy_id is None:
            return None
        policy = next((item for item in self._policies if item.id == policy_id), None)
        if policy is None or policy.deal_id is None:
            QMessageBox.warning(self, _("Создание платежа"), _("У выбранного полиса отсутствует связанная сделка."))
            return None

        payload = self._build_common_payload()
        if payload is None:
            return None
        payload.pop("status", None)  # статус меняется только при обновлении

        return policy.deal_id, policy_id, payload

    def update_payload(self, payment: Payment) -> dict[str, object] | None:
        payload = self._build_common_payload()
        if payload is None:
            return None

        changes: dict[str, object] = {}

        status = payload.get("status")
        if status and status != (payment.status or ""):
            changes["status"] = status
        elif not status and payment.status:
            changes["status"] = None

        amount = payload.get("planned_amount")
        if amount is not None and (payment.planned_amount is None or abs(float(payment.planned_amount) - amount) > 1e-6):
            changes["planned_amount"] = amount

        currency = payload.get("currency")
        if currency and currency != (payment.currency or ""):
            changes["currency"] = currency

        planned_date = payload.get("planned_date")
        if planned_date != (payment.planned_date.isoformat() if payment.planned_date else None):
            changes["planned_date"] = planned_date

        actual_date = payload.get("actual_date")
        if actual_date != (payment.actual_date.isoformat() if payment.actual_date else None):
            changes["actual_date"] = actual_date

        comment = payload.get("comment")
        current_comment = payment.comment or ""
        if comment != current_comment:
            changes["comment"] = comment or None

        return changes

    def _build_common_payload(self) -> dict[str, object] | None:
        amount = float(self.amount_spin.value())
        if amount <= 0:
            QMessageBox.warning(self, _("Валидация"), _("Укажите положительную сумму платежа."))
            return None

        currency = self.currency_edit.text().strip().upper()
        if not currency:
            QMessageBox.warning(self, _("Валидация"), _("Укажите валюту платежа."))
            return None

        planned_date = self.planned_date_edit.text().strip()
        parsed_planned = _parse_date(planned_date) if planned_date else None
        if planned_date and parsed_planned is None:
            QMessageBox.warning(self, _("Валидация"), _("Некорректный формат плановой даты. Используйте ГГГГ-ММ-ДД."))
            return None

        actual_date = self.actual_date_edit.text().strip()
        parsed_actual = _parse_date(actual_date) if actual_date else None
        if actual_date and parsed_actual is None:
            QMessageBox.warning(self, _("Валидация"), _("Некорректный формат фактической даты. Используйте ГГГГ-ММ-ДД."))
            return None

        payload: dict[str, object] = {
            "planned_amount": amount,
            "currency": currency,
            "comment": self.comment_edit.toPlainText().strip() or None,
        }

        status = self.status_combo.currentText().strip()
        if status:
            payload["status"] = status

        if parsed_planned:
            payload["planned_date"] = parsed_planned.isoformat()
        if parsed_actual:
            payload["actual_date"] = parsed_actual.isoformat()

        return payload

    def _on_accept(self) -> None:
        if self.policy_combo.currentData() is None and self._payment is None:
            QMessageBox.warning(self, _("Валидация"), _("Выберите полис для создания платежа."))
            return

        if self._build_common_payload() is None:
            return

        self.accept()
