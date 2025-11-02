from __future__ import annotations

from datetime import datetime
from typing import Iterable, Sequence
from uuid import UUID

from PySide6.QtCore import QDateTime
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDateTimeEdit,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QHBoxLayout,
    QLineEdit,
    QMessageBox,
    QPlainTextEdit,
    QWidget,
)

from core.app_context import AppContext
from models import Client, Deal, Policy, Task
from i18n import _


def _to_datetime(edit: QDateTimeEdit) -> datetime:
    return edit.dateTime().toPython()


class TaskDialog(QDialog):
    """Dialog for creating or editing tasks."""

    STATUS_DEFAULTS = ("pending", "scheduled", "in_progress", "completed", "cancelled")
    PRIORITIES = (("", _("Не выбрано")), ("low", _("Низкий")), ("normal", _("Средний")), ("high", _("Высокий")))

    def __init__(
        self,
        *,
        context: AppContext,
        clients: Iterable[Client],
        deals: Iterable[Deal],
        policies: Iterable[Policy],
        status_options: Sequence[str] | None = None,
        parent=None,
        task: Task | None = None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle(_("Новая задача") if task is None else _("Редактирование задачи"))
        self._context = context
        self._task = task
        self._clients = list(clients)
        self._deals = list(deals)
        self._policies = list(policies)

        self.title_edit = QLineEdit(self)
        self.description_edit = QPlainTextEdit(self)

        self.status_combo = QComboBox(self)
        self.status_combo.setEditable(True)
        statuses = [status for status in (status_options or []) if status]
        for default_status in self.STATUS_DEFAULTS:
            if default_status not in statuses:
                statuses.append(default_status)
        if task and task.status_code and task.status_code not in statuses:
            statuses.insert(0, task.status_code)
        for status in statuses:
            self.status_combo.addItem(status)

        self.priority_combo = QComboBox(self)
        for value, label in self.PRIORITIES:
            self.priority_combo.addItem(label, value)

        self.assignee_edit = QLineEdit(self)
        self.author_edit = QLineEdit(self)

        self.deal_combo = QComboBox(self)
        self.deal_combo.addItem(_("Не выбрано"), None)
        for deal in self._deals:
            self.deal_combo.addItem(deal.title or str(deal.id), deal.id)
        self.deal_combo.currentIndexChanged.connect(self._on_deal_changed)  # type: ignore[arg-type]

        self.policy_combo = QComboBox(self)
        self.policy_combo.addItem(_("Не выбрано"), None)

        self.client_combo = QComboBox(self)
        self.client_combo.addItem(_("Не выбрано"), None)
        for client in self._clients:
            self.client_combo.addItem(client.name, client.id)

        self.due_checkbox = QCheckBox(_("Указать срок"), self)
        self.due_edit = QDateTimeEdit(QDateTime.currentDateTime(), self)
        self.due_edit.setDisplayFormat("yyyy-MM-dd HH:mm")
        self.due_edit.setCalendarPopup(True)
        self.due_edit.setEnabled(False)
        self.due_checkbox.toggled.connect(self.due_edit.setEnabled)  # type: ignore[arg-type]

        self.scheduled_checkbox = QCheckBox(_("Запланировать"), self)
        self.scheduled_edit = QDateTimeEdit(QDateTime.currentDateTime(), self)
        self.scheduled_edit.setDisplayFormat("yyyy-MM-dd HH:mm")
        self.scheduled_edit.setCalendarPopup(True)
        self.scheduled_edit.setEnabled(False)
        self.scheduled_checkbox.toggled.connect(self.scheduled_edit.setEnabled)  # type: ignore[arg-type]

        self.cancelled_reason_edit = QLineEdit(self)

        form = QFormLayout(self)
        form.addRow(_("Название *"), self.title_edit)
        form.addRow(_("Описание *"), self.description_edit)
        form.addRow(_("Статус"), self.status_combo)
        form.addRow(_("Приоритет"), self.priority_combo)
        form.addRow(_("Исполнитель *"), self.assignee_edit)
        form.addRow(_("Автор *"), self.author_edit)
        form.addRow(_("Сделка"), self.deal_combo)
        form.addRow(_("Полис"), self.policy_combo)
        form.addRow(_("Клиент"), self.client_combo)

        due_row = QWidget(self)
        due_layout = QHBoxLayout(due_row)
        due_layout.setContentsMargins(0, 0, 0, 0)
        due_layout.addWidget(self.due_checkbox)
        due_layout.addWidget(self.due_edit)
        form.addRow(_("Дедлайн"), due_row)

        scheduled_row = QWidget(self)
        scheduled_layout = QHBoxLayout(scheduled_row)
        scheduled_layout.setContentsMargins(0, 0, 0, 0)
        scheduled_layout.addWidget(self.scheduled_checkbox)
        scheduled_layout.addWidget(self.scheduled_edit)
        form.addRow(_("Запланировано на"), scheduled_row)

        form.addRow(_("Причина отмены"), self.cancelled_reason_edit)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, parent=self)
        buttons.accepted.connect(self._on_accept)  # type: ignore[arg-type]
        buttons.rejected.connect(self.reject)  # type: ignore[arg-type]
        form.addRow(buttons)

        self._populate_policy_combo()

        # Prefill existing values
        if task is not None:
            self.title_edit.setText(task.title)
            if task.description:
                self.description_edit.setPlainText(task.description)
            if task.status_code:
                status_index = self.status_combo.findText(task.status_code)
                if status_index >= 0:
                    self.status_combo.setCurrentIndex(status_index)
                else:
                    self.status_combo.setEditText(task.status_code)
            if task.priority:
                priority_index = self.priority_combo.findData(task.priority)
                if priority_index >= 0:
                    self.priority_combo.setCurrentIndex(priority_index)
            if task.assignee_id:
                self.assignee_edit.setText(str(task.assignee_id))
            if task.author_id:
                self.author_edit.setText(str(task.author_id))
            if task.deal_id:
                self._ensure_item_in_combo(self.deal_combo, task.deal_id, self._context.get_deal_title(task.deal_id))
            if task.policy_id:
                self._ensure_item_in_combo(self.policy_combo, task.policy_id, self._context.get_policy_number(task.policy_id))
            if task.client_id:
                self._ensure_item_in_combo(self.client_combo, task.client_id, self._context.get_client_name(task.client_id))
            if task.due_at:
                self.due_checkbox.setChecked(True)
                self.due_edit.setDateTime(QDateTime(task.due_at))
            if task.scheduled_for:
                self.scheduled_checkbox.setChecked(True)
                self.scheduled_edit.setDateTime(QDateTime(task.scheduled_for))
            if task.cancelled_reason:
                self.cancelled_reason_edit.setText(task.cancelled_reason)
        else:
            owner_id = context.get_current_user_id()
            if owner_id is not None:
                user_id = str(owner_id)
                self.assignee_edit.setText(user_id)
                self.author_edit.setText(user_id)
            if self.status_combo.count():
                self.status_combo.setCurrentIndex(0)
            self.priority_combo.setCurrentIndex(0)

        self._populate_policy_combo()

    def payload(self) -> dict[str, object] | None:
        """Build payload for task creation."""
        title = self.title_edit.text().strip()
        if not title:
            QMessageBox.warning(self, _("Валидация"), _("Введите название задачи."))
            return None

        description = self.description_edit.toPlainText().strip()
        if not description:
            QMessageBox.warning(self, _("Валидация"), _("Заполните описание задачи."))
            return None

        assignee = self.assignee_edit.text().strip()
        author = self.author_edit.text().strip()
        if not assignee or not author:
            QMessageBox.warning(self, _("Валидация"), _("Укажите идентификаторы исполнителя и автора."))
            return None

        payload: dict[str, object] = {
            "subject": title,
            "description": description,
            "assignee_id": assignee,
            "author_id": author,
            "initial_status": self.status_combo.currentText().strip() or "pending",
        }

        priority_value = self.priority_combo.currentData()
        if priority_value:
            payload["priority"] = priority_value

        if self.due_checkbox.isChecked():
            payload["due_at"] = _to_datetime(self.due_edit).isoformat()
        if self.scheduled_checkbox.isChecked():
            payload["scheduled_for"] = _to_datetime(self.scheduled_edit).isoformat()

        context_payload: dict[str, object] = {}
        client_id = self.client_combo.currentData()
        if client_id:
            context_payload["clientId"] = str(client_id)
        deal_id = self.deal_combo.currentData()
        if deal_id:
            context_payload["dealId"] = str(deal_id)
        policy_id = self.policy_combo.currentData()
        if policy_id:
            context_payload["policyId"] = str(policy_id)

        if context_payload:
            payload["context"] = context_payload

        return payload

    def update_payload(self, task: Task) -> dict[str, object]:
        """Build payload for task update."""
        changes: dict[str, object] = {}

        status = self.status_combo.currentText().strip()
        if status and status != task.status_code:
            changes["status"] = status

        if self.due_checkbox.isChecked():
            due_value = _to_datetime(self.due_edit).isoformat()
            if not task.due_at or task.due_at.isoformat() != due_value:
                changes["due_at"] = due_value
        else:
            if task.due_at is not None:
                changes["due_at"] = None

        if self.scheduled_checkbox.isChecked():
            scheduled_value = _to_datetime(self.scheduled_edit).isoformat()
            if not task.scheduled_for or task.scheduled_for.isoformat() != scheduled_value:
                changes["scheduled_for"] = scheduled_value
        else:
            if task.scheduled_for is not None:
                changes["scheduled_for"] = None

        cancelled_reason = self.cancelled_reason_edit.text().strip()
        task_reason = task.cancelled_reason or ""
        if cancelled_reason != task_reason:
            changes["cancelled_reason"] = cancelled_reason or None

        return changes

    def _populate_policy_combo(self) -> None:
        self.policy_combo.blockSignals(True)
        current_deal_id = self.deal_combo.currentData()
        current_policy_id = self.policy_combo.currentData()
        self.policy_combo.clear()
        self.policy_combo.addItem(_("Не выбрано"), None)
        for policy in self._policies:
            if current_deal_id and policy.deal_id and policy.deal_id != current_deal_id:
                continue
            label = policy.policy_number
            self.policy_combo.addItem(label, policy.id)
        self.policy_combo.blockSignals(False)
        if current_policy_id:
            index = self.policy_combo.findData(current_policy_id)
            if index >= 0:
                self.policy_combo.setCurrentIndex(index)
            else:
                self.policy_combo.setCurrentIndex(0)
        else:
            self.policy_combo.setCurrentIndex(0)

    def _ensure_item_in_combo(self, combo: QComboBox, value: UUID, label: str) -> None:
        index = combo.findData(value)
        if index == -1:
            combo.addItem(label or str(value), value)
            index = combo.count() - 1
        combo.setCurrentIndex(index)

    def _on_deal_changed(self) -> None:
        self._populate_policy_combo()

    def _on_accept(self) -> None:
        # Reuse payload builder to perform validations
        if self._task is None:
            if self.payload() is None:
                return
        else:
            # For updates, ensure due/scheduled selections consistent even if payload remains empty
            if self.scheduled_checkbox.isChecked() and not self.status_combo.currentText().strip():
                QMessageBox.warning(self, _("Валидация"), _("Выберите статус задачи."))
                return
        self.accept()
