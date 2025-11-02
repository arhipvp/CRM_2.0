from __future__ import annotations

from datetime import date, datetime
from typing import Iterable, Sequence
from uuid import UUID

from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QDoubleSpinBox,
    QFormLayout,
    QHBoxLayout,
    QLineEdit,
    QMessageBox,
    QWidget,
)

from core.app_context import AppContext
from models import Client, Deal, Policy
from i18n import _


def _normalize_uuid(value: object) -> UUID | None:
    if value is None:
        return None
    try:
        return UUID(str(value))
    except ValueError:
        return None


def _parse_date(text: str) -> date | None:
    if not text:
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        return None


class PolicyDialog(QDialog):
    """Dialog for creating or editing policies."""

    DEFAULT_STATUSES = ("draft", "active", "suspended", "cancelled")

    def __init__(
        self,
        *,
        context: AppContext,
        clients: Iterable[Client],
        deals: Iterable[Deal],
        status_options: Sequence[str] | None = None,
        parent=None,
        policy: Policy | None = None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle(_("Новый полис") if policy is None else _("Редактирование полиса"))
        self._context = context
        self._policy = policy
        self._clients = list(clients)
        self._deals = list(deals)

        self.policy_number_edit = QLineEdit(self)
        self.status_combo = QComboBox(self)
        self.status_combo.setEditable(True)

        statuses = list(dict.fromkeys([status for status in (status_options or []) if status]))
        for default_status in self.DEFAULT_STATUSES:
            if default_status not in statuses:
                statuses.append(default_status)
        if policy and policy.status and policy.status not in statuses:
            statuses.insert(0, policy.status)
        for status in statuses:
            self.status_combo.addItem(status)

        self.client_combo = QComboBox(self)
        for client in self._clients:
            self.client_combo.addItem(client.name, client.id)
        self.client_combo.currentIndexChanged.connect(self._on_client_changed)  # type: ignore[arg-type]

        self.deal_combo = QComboBox(self)
        self.deal_combo.setEditable(False)
        self.deal_combo.addItem(_("Не выбрано"), None)

        self.premium_checkbox = QCheckBox(_("Указать премию"), self)
        self.premium_spin = QDoubleSpinBox(self)
        self.premium_spin.setDecimals(2)
        self.premium_spin.setMaximum(1_000_000_000)
        self.premium_spin.setEnabled(False)
        self.premium_checkbox.toggled.connect(self.premium_spin.setEnabled)  # type: ignore[arg-type]

        self.effective_from_edit = QLineEdit(self)
        self.effective_from_edit.setPlaceholderText(_("ГГГГ-ММ-ДД"))
        self.effective_to_edit = QLineEdit(self)
        self.effective_to_edit.setPlaceholderText(_("ГГГГ-ММ-ДД"))

        self.owner_edit = QLineEdit(self)

        form = QFormLayout(self)
        form.addRow(_("Номер полиса *"), self.policy_number_edit)
        form.addRow(_("Статус"), self.status_combo)
        form.addRow(_("Клиент *"), self.client_combo)
        form.addRow(_("Сделка"), self.deal_combo)

        premium_row = QWidget(self)
        premium_layout = QHBoxLayout(premium_row)
        premium_layout.setContentsMargins(0, 0, 0, 0)
        premium_layout.addWidget(self.premium_checkbox)
        premium_layout.addWidget(self.premium_spin, 1)
        form.addRow(_("Премия"), premium_row)

        form.addRow(_("Начало действия"), self.effective_from_edit)
        form.addRow(_("Окончание действия"), self.effective_to_edit)
        form.addRow(_("Владелец"), self.owner_edit)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, parent=self)
        buttons.accepted.connect(self._on_accept)  # type: ignore[arg-type]
        buttons.rejected.connect(self.reject)  # type: ignore[arg-type]
        form.addRow(buttons)

        # Pre-fill values
        if policy is not None:
            self.policy_number_edit.setText(policy.policy_number)
            if policy.status:
                index = self.status_combo.findText(policy.status)
                if index >= 0:
                    self.status_combo.setCurrentIndex(index)
            self._ensure_client_in_combo(policy.client_id)
            self._ensure_deal_in_combo(policy.deal_id)
            if policy.premium is not None:
                self.premium_checkbox.setChecked(True)
                self.premium_spin.setValue(float(policy.premium))
            if policy.effective_from:
                self.effective_from_edit.setText(policy.effective_from.isoformat())
            if policy.effective_to:
                self.effective_to_edit.setText(policy.effective_to.isoformat())
            if policy.owner_id:
                self.owner_edit.setText(str(policy.owner_id))
        else:
            if self.status_combo.count():
                self.status_combo.setCurrentIndex(0)
            owner_id = context.get_current_user_id()
            if owner_id is not None:
                self.owner_edit.setText(str(owner_id))

        # Initialize deal combo for current client
        self._rebuild_deal_combo(selected_deal_id=self._policy.deal_id if self._policy else None)

    def payload(self) -> dict[str, object] | None:
        """Build create payload."""
        client_id = self.client_combo.currentData()
        if client_id is None:
            return None

        deal_id = self.deal_combo.currentData()
        data: dict[str, object] = {
            "policy_number": self.policy_number_edit.text().strip(),
            "status": self.status_combo.currentText().strip() or "draft",
            "client_id": str(client_id),
        }
        if deal_id:
            data["deal_id"] = str(deal_id)

        if self.premium_checkbox.isChecked():
            data["premium"] = float(self.premium_spin.value())

        effective_from = _parse_date(self.effective_from_edit.text().strip())
        effective_to = _parse_date(self.effective_to_edit.text().strip())
        if effective_from:
            data["effective_from"] = effective_from.isoformat()
        if effective_to:
            data["effective_to"] = effective_to.isoformat()

        owner_value = self.owner_edit.text().strip()
        if owner_value:
            data["owner_id"] = owner_value

        return data

    def update_payload(self, policy: Policy) -> dict[str, object]:
        """Build partial update payload."""
        changes: dict[str, object] = {}

        policy_number = self.policy_number_edit.text().strip()
        if policy_number and policy_number != policy.policy_number:
            changes["policy_number"] = policy_number

        status = self.status_combo.currentText().strip()
        if status and status != (policy.status or ""):
            changes["status"] = status

        client_id = _normalize_uuid(self.client_combo.currentData())
        if client_id is not None and client_id != policy.client_id:
            changes["client_id"] = str(client_id)

        deal_id = _normalize_uuid(self.deal_combo.currentData())
        if deal_id != (policy.deal_id or None):
            changes["deal_id"] = str(deal_id) if deal_id else None

        if self.premium_checkbox.isChecked():
            premium_value = float(self.premium_spin.value())
            if policy.premium is None or abs(float(policy.premium) - premium_value) > 1e-6:
                changes["premium"] = premium_value
        elif policy.premium is not None:
            changes["premium"] = None

        from_value = _parse_date(self.effective_from_edit.text().strip())
        if from_value != (policy.effective_from or None):
            changes["effective_from"] = from_value.isoformat() if from_value else None

        to_value = _parse_date(self.effective_to_edit.text().strip())
        if to_value != (policy.effective_to or None):
            changes["effective_to"] = to_value.isoformat() if to_value else None

        owner_value = self.owner_edit.text().strip()
        owner_uuid = owner_value or None
        if owner_uuid != (str(policy.owner_id) if policy.owner_id else None):
            changes["owner_id"] = owner_uuid

        return changes

    def _ensure_client_in_combo(self, client_id: UUID | None) -> None:
        if client_id is None:
            if self.client_combo.count():
                self.client_combo.setCurrentIndex(0)
            return
        index = self.client_combo.findData(client_id)
        if index == -1:
            self.client_combo.addItem(str(client_id), client_id)
            index = self.client_combo.count() - 1
        self.client_combo.setCurrentIndex(index)

    def _ensure_deal_in_combo(self, deal_id: UUID | None) -> None:
        if deal_id is None:
            self.deal_combo.setCurrentIndex(0)
            return
        index = self.deal_combo.findData(deal_id)
        if index == -1:
            self.deal_combo.addItem(str(deal_id), deal_id)
            index = self.deal_combo.count() - 1
        self.deal_combo.setCurrentIndex(index)

    def _rebuild_deal_combo(self, *, selected_deal_id: UUID | None) -> None:
        current_client_id = _normalize_uuid(self.client_combo.currentData())
        current_selection = selected_deal_id if selected_deal_id is not None else _normalize_uuid(self.deal_combo.currentData())

        self.deal_combo.blockSignals(True)
        self.deal_combo.clear()
        self.deal_combo.addItem(_("Не выбрано"), None)

        for deal in self._deals:
            if current_client_id and deal.client_id and deal.client_id != current_client_id:
                continue
            title = deal.title or str(deal.id)
            self.deal_combo.addItem(title, deal.id)
        self.deal_combo.blockSignals(False)

        if current_selection:
            index = self.deal_combo.findData(current_selection)
            if index >= 0:
                self.deal_combo.setCurrentIndex(index)
            else:
                self.deal_combo.setCurrentIndex(0)
        else:
            self.deal_combo.setCurrentIndex(0)

    def _on_client_changed(self) -> None:
        self._rebuild_deal_combo(selected_deal_id=None)

    def _on_accept(self) -> None:
        policy_number = self.policy_number_edit.text().strip()
        if not policy_number:
            QMessageBox.warning(self, _("Валидация"), _("Введите номер полиса."))
            return

        if self.client_combo.currentData() is None:
            QMessageBox.warning(self, _("Валидация"), _("Выберите клиента."))
            return

        from_value = self.effective_from_edit.text().strip()
        to_value = self.effective_to_edit.text().strip()
        parsed_from = _parse_date(from_value) if from_value else None
        if from_value and parsed_from is None:
            QMessageBox.warning(self, _("Валидация"), _("Некорректный формат даты начала действия. Используйте ГГГГ-ММ-ДД."))
            return
        parsed_to = _parse_date(to_value) if to_value else None
        if to_value and parsed_to is None:
            QMessageBox.warning(self, _("Валидация"), _("Некорректный формат даты окончания действия. Используйте ГГГГ-ММ-ДД."))
            return
        if parsed_from and parsed_to and parsed_to < parsed_from:
            QMessageBox.warning(self, _("Валидация"), _("Дата окончания должна быть не раньше даты начала."))
            return

        self.accept()
