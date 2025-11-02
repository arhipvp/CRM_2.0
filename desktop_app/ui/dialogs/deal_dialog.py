from __future__ import annotations

from datetime import date, datetime
from typing import Dict, Iterable, Optional, Sequence
from uuid import UUID

from PySide6.QtCore import QDate
from PySide6.QtWidgets import (
    QComboBox,
    QDateEdit,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QMessageBox,
    QPlainTextEdit,
    QPushButton,
    QLabel,
    QWidget,
    QHBoxLayout,
    QLineEdit,
    QTabWidget,
    QTableWidget,
    QTableWidgetItem,
)

from api.client import APIClientError
from core.app_context import AppContext
from models import Client, Deal, Payment, Policy, Task
from ui.dialogs.client_dialog import ClientDialog
from ui.dialogs.payment_dialog import PaymentDialog
from ui.dialogs.policy_dialog import PolicyDialog
from ui.dialogs.task_dialog import TaskDialog
from i18n import _


class DealDialog(QDialog):
    STATUS_OPTIONS = ["draft", "in_progress", "negotiation", "won", "lost"]

    def __init__(
        self,
        *,
        context: AppContext,
        clients: Iterable[Client],
        parent=None,
        deal: Deal | None = None,
    ) -> None:
        super().__init__(parent)
        self.setWindowTitle(_("New deal") if deal is None else _("Edit deal"))
        self._context = context
        self._deal = deal
        self._policies: list[Policy] = []
        self._payments: list[Payment] = []
        self._tasks: list[Task] = []

        self.title_edit = QLineEdit(self)
        self.description_edit = QPlainTextEdit(self)
        self.status_combo = QComboBox(self)
        self.status_combo.addItems(self.STATUS_OPTIONS)
        self.next_review_edit = QDateEdit(self)
        self.next_review_edit.setCalendarPopup(True)
        self.next_review_edit.setDisplayFormat("yyyy-MM-dd")

        self.client_combo = QComboBox(self)
        self._clients: list[Client] = list(clients)
        for client in self._clients:
            self.client_combo.addItem(client.name, client.id)

        self.add_client_button = QPushButton(_("Add client"), self)
        self.add_client_button.clicked.connect(self._handle_add_client)

        client_row = QWidget(self)
        row_layout = QHBoxLayout(client_row)
        row_layout.setContentsMargins(0, 0, 0, 0)
        row_layout.addWidget(self.client_combo, 1)
        row_layout.addWidget(self.add_client_button)

        form = QFormLayout(self)
        form.addRow(_("Title *"), self.title_edit)
        form.addRow(_("Description"), self.description_edit)
        form.addRow(_("Status"), self.status_combo)
        form.addRow(_("Next review *"), self.next_review_edit)
        form.addRow(_("Client *"), client_row)

        self.tabs: Optional[QTabWidget] = None
        self._actions_widget: Optional[QWidget] = None

        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            parent=self,
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        form.addRow(buttons)

        today = date.today()
        if deal is None:
            self.status_combo.setCurrentText("in_progress")
            self.next_review_edit.setDate(QDate(today.year, today.month, today.day))
        else:
            self.title_edit.setText(deal.title)
            if deal.description:
                self.description_edit.setPlainText(deal.description)
            if deal.status:
                index = self.status_combo.findText(deal.status)
                if index >= 0:
                    self.status_combo.setCurrentIndex(index)
                else:
                    self.status_combo.insertItem(0, deal.status)
                    self.status_combo.setCurrentIndex(0)
            if deal.next_review_at:
                qdate = QDate(
                    deal.next_review_at.year,
                    deal.next_review_at.month,
                    deal.next_review_at.day,
                )
                self.next_review_edit.setDate(qdate)
            if deal.client_id:
                idx = self.client_combo.findData(deal.client_id)
                if idx >= 0:
                    self.client_combo.setCurrentIndex(idx)
            self.client_combo.setEnabled(False)
            self.add_client_button.setVisible(False)

            self._actions_widget = QWidget(self)
            actions_layout = QHBoxLayout(self._actions_widget)
            actions_layout.setContentsMargins(0, 0, 0, 0)
            self._create_action_buttons(actions_layout)
            form.addRow(self._actions_widget)

            self.tabs = QTabWidget(self)
            form.addRow(self.tabs)
            self._build_tab_widgets()
            self._refresh_related_data()

    def _handle_add_client(self) -> None:
        dialog = ClientDialog(parent=self)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return
        try:
            client = self._context.api.create_client(dialog.payload())
        except APIClientError as exc:
            QMessageBox.critical(self, _("Create client"), str(exc))
            return

        self._context.update_clients([client])
        self._clients.append(client)
        self.client_combo.addItem(client.name, client.id)
        self.client_combo.setCurrentIndex(self.client_combo.count() - 1)

    def _on_accept(self) -> None:
        if not self.title_edit.text().strip():
            QMessageBox.warning(self, _("Validation"), _("Enter a deal title."))
            return
        if self.client_combo.currentIndex() < 0:
            QMessageBox.warning(self, _("Validation"), _("Select a client."))
            return
        if not self.next_review_edit.date().isValid():
            QMessageBox.warning(self, _("Validation"), _("Select a review date."))
            return
        self.accept()

    def payload(self) -> Dict[str, object]:
        qdate = self.next_review_edit.date()
        next_review_at = date(qdate.year(), qdate.month(), qdate.day()).isoformat()
        client_id = self.client_combo.currentData()
        return {
            "title": self.title_edit.text().strip(),
            "description": self.description_edit.toPlainText().strip() or None,
            "status": self.status_combo.currentText(),
            "next_review_at": next_review_at,
            "client_id": str(client_id),
        }

    def update_payload(self, deal: Deal) -> Dict[str, object]:
        changes: Dict[str, object] = {}
        title = self.title_edit.text().strip()
        if title and title != deal.title:
            changes["title"] = title

        description = self.description_edit.toPlainText().strip()
        if description != (deal.description or ""):
            changes["description"] = description or None

        status = self.status_combo.currentText()
        if status and status != (deal.status or ""):
            changes["status"] = status

        qdate = self.next_review_edit.date()
        new_date = date(qdate.year(), qdate.month(), qdate.day())
        if deal.next_review_at != new_date:
            changes["next_review_at"] = new_date.isoformat()

        return changes

    # ---- related data -----------------------------------------------------
    def _create_action_buttons(self, layout: QHBoxLayout) -> None:
        self._create_task_button = QPushButton(_("Создать задачу"), self)
        self._create_task_button.clicked.connect(self._handle_create_task)
        layout.addWidget(self._create_task_button)

        self._create_policy_button = QPushButton(_("Добавить полис"), self)
        self._create_policy_button.clicked.connect(self._handle_create_policy)
        layout.addWidget(self._create_policy_button)

        self._create_payment_button = QPushButton(_("Добавить платеж"), self)
        self._create_payment_button.clicked.connect(self._handle_create_payment)
        layout.addWidget(self._create_payment_button)

        self._refresh_button = QPushButton(_("Обновить"), self)
        self._refresh_button.clicked.connect(self._refresh_related_data)
        layout.addWidget(self._refresh_button)

        layout.addStretch(1)

    def _build_tab_widgets(self) -> None:
        if self.tabs is None:
            return

        self._summary_widget = QWidget(self.tabs)
        summary_layout = QFormLayout(self._summary_widget)
        summary_layout.setContentsMargins(0, 0, 0, 0)
        self._summary_labels: dict[str, QLabel] = {}
        for key, title in [
            ("status", _("Статус")),
            ("stage", _("Этап")),
            ("next_review", _("Следующая проверка")),
            ("client", _("Клиент")),
            ("policies_count", _("Полисов")),
            ("payments_total", _("Плановые выплаты")),
            ("net_total", _("Финансовый результат")),
            ("open_tasks", _("Открытые задачи")),
            ("created", _("Создано")),
            ("updated", _("Обновлено")),
        ]:
            label = QLabel("", self._summary_widget)
            label.setWordWrap(True)
            self._summary_labels[key] = label
            summary_layout.addRow(title, label)
        self.tabs.addTab(self._summary_widget, _("Сводка"))

        self._client_widget = QWidget(self.tabs)
        client_layout = QFormLayout(self._client_widget)
        client_layout.setContentsMargins(0, 0, 0, 0)
        self._client_labels: dict[str, QLabel] = {}
        for key, title in [
            ("name", _("Имя клиента")),
            ("email", _("Email")),
            ("phone", _("Телефон")),
            ("client_status", _("Статус клиента")),
            ("owner", _("Ответственный за сделку")),
        ]:
            label = QLabel("", self._client_widget)
            label.setWordWrap(True)
            self._client_labels[key] = label
            client_layout.addRow(title, label)
        self.tabs.addTab(self._client_widget, _("Контакты"))

        self._documents_widget = QPlainTextEdit(self.tabs)
        self._documents_widget.setReadOnly(True)
        self._documents_widget.setObjectName("documentsTab")
        self._documents_widget.setPlainText(_("Данные загружаются..."))
        self.tabs.addTab(self._documents_widget, _("Документы"))

        self._history_widget = QPlainTextEdit(self.tabs)
        self._history_widget.setReadOnly(True)
        self._history_widget.setObjectName("historyTab")
        self._history_widget.setPlainText(_("Данные загружаются..."))
        self.tabs.addTab(self._history_widget, _("История"))

        self._policies_table = self._create_table(
            [_("ID"), _("Policy #"), _("Client"), _("Status"), _("Premium"), _("Effective From"), _("Effective To"), _("Owner ID"), _("Created"), _("Updated")]
        )
        self.tabs.addTab(self._policies_table, _("Полисы"))

        self._payments_table = self._create_table(
            [_("ID"), _("Policy #"), _("Seq"), _("Status"), _("Planned Date"), _("Actual Date"), _("Planned Amount"), _("Currency"), _("Comment"), _("Incomes"), _("Expenses"), _("Net")]
        )
        self.tabs.addTab(self._payments_table, _("Платежи"))

        self._tasks_table = self._create_table(
            [_("ID"), _("Title"), _("Description"), _("Status"), _("Assignee"), _("Author"), _("Policy"), _("Due"), _("Created"), _("Updated")]
        )
        self.tabs.addTab(self._tasks_table, _("Задачи"))

        self._finance_table = self._create_table(
            [_("ID"), _("Policy #"), _("Incomes"), _("Expenses"), _("Net")]
        )
        self.tabs.addTab(self._finance_table, _("Финансы"))

    def _refresh_related_data(self) -> None:
        if self._deal is None or self.tabs is None:
            return

        policies, payments, tasks = self._load_related_entities(self._deal)
        self._policies = policies
        self._payments = payments
        self._tasks = tasks

        self._context.update_policies(policies)
        self._context.update_tasks(tasks)

        self._populate_table(
            self._policies_table,
            [
                (
                    str(policy.id),
                    policy.policy_number,
                    self._context.get_client_name(policy.client_id),
                    policy.status or "",
                    _format_money(policy.premium),
                    policy.effective_from.isoformat() if policy.effective_from else "",
                    policy.effective_to.isoformat() if policy.effective_to else "",
                    str(policy.owner_id) if policy.owner_id else "",
                    policy.created_at.strftime("%Y-%m-%d %H:%M") if policy.created_at else "",
                    policy.updated_at.strftime("%Y-%m-%d %H:%M") if policy.updated_at else "",
                )
                for policy in self._policies
            ],
        )

        policy_map: Dict[UUID, str] = {policy.id: policy.policy_number for policy in self._policies}
        self._populate_table(
            self._payments_table,
            [
                (
                    str(payment.id),
                    policy_map.get(payment.policy_id, ""),
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
                for payment in self._payments
            ],
        )

        self._populate_table(
            self._tasks_table,
            [
                (
                    str(task.id),
                    task.title,
                    task.description or "",
                    task.status_name or task.status_code or "",
                    str(task.assignee_id) if task.assignee_id else "",
                    str(task.author_id) if task.author_id else "",
                    self._context.get_policy_number(task.policy_id) if task.policy_id else "",
                    task.due_at.strftime("%Y-%m-%d %H:%M") if task.due_at else "",
                    task.created_at.strftime("%Y-%m-%d %H:%M") if task.created_at else "",
                    task.updated_at.strftime("%Y-%m-%d %H:%M") if task.updated_at else "",
                )
                for task in self._tasks
            ],
        )

        finance_rows = []
        for policy in self._policies:
            policy_payments = [payment for payment in self._payments if payment.policy_id == policy.id]
            incomes = sum(payment.incomes_total or 0 for payment in policy_payments)
            expenses = sum(payment.expenses_total or 0 for payment in policy_payments)
            net = sum(payment.net_total or 0 for payment in policy_payments)
            finance_rows.append(
                (
                    str(policy.id),
                    policy.policy_number,
                    _format_money(incomes),
                    _format_money(expenses),
                    _format_money(net),
                )
            )
        self._populate_table(self._finance_table, finance_rows)

        self._update_summary_tab()
        self._update_contacts_tab()
        self._update_documents_tab()
        self._update_history_tab()
        self._update_action_states()

    def _load_related_entities(self, deal: Deal) -> tuple[list[Policy], list[Payment], list[Task]]:
        try:
            policies = [policy for policy in self._context.api.fetch_policies() if policy.deal_id == deal.id]
        except APIClientError as exc:
            QMessageBox.warning(self, _("Load policies"), str(exc))
            policies = []

        payments: list[Payment] = []
        payment_errors: set[str] = set()
        for policy in policies:
            try:
                payments.extend(self._context.api.fetch_payments(deal.id, policy.id))
            except APIClientError as exc:
                payment_errors.add(str(exc))
        if payment_errors:
            QMessageBox.warning(self, _("Load payments"), "\n".join(payment_errors))

        try:
            tasks = [task for task in self._context.api.fetch_tasks() if task.deal_id == deal.id]
        except APIClientError as exc:
            QMessageBox.warning(self, _("Load tasks"), str(exc))
            tasks = []

        return policies, payments, tasks

    def _update_summary_tab(self) -> None:
        if self._deal is None or not hasattr(self, "_summary_labels"):
            return
        total_planned = sum(payment.planned_amount or 0 for payment in self._payments)
        total_net = sum(payment.net_total or 0 for payment in self._payments)
        open_tasks = len(
            [
                task
                for task in self._tasks
                if (task.status_code or "").lower() not in {"completed", "cancelled"}
            ]
        )

        summary_values = {
            "status": self._deal.status or _("Не указано"),
            "stage": self._deal.stage or _("Не указано"),
            "next_review": self._deal.next_review_at.strftime("%Y-%m-%d") if self._deal.next_review_at else _("Не запланировано"),
            "client": self._context.get_client_name(self._deal.client_id),
            "policies_count": str(len(self._policies)),
            "payments_total": _format_money(total_planned),
            "net_total": _format_money(total_net),
            "open_tasks": str(open_tasks),
            "created": self._format_datetime(self._deal.created_at),
            "updated": self._format_datetime(self._deal.updated_at),
        }

        for key, value in summary_values.items():
            label = self._summary_labels.get(key)
            if label is not None:
                label.setText(value)

    def _update_contacts_tab(self) -> None:
        if self._deal is None or not hasattr(self, "_client_labels"):
            return
        client = self._resolve_client(self._deal.client_id)
        self._client_labels["name"].setText(client.name if client else self._context.get_client_name(self._deal.client_id))
        self._client_labels["email"].setText(client.email or _("Не указано") if client else _("Не указано"))
        self._client_labels["phone"].setText(client.phone or _("Не указано") if client else _("Не указано"))
        self._client_labels["client_status"].setText(client.status or _("Не указано") if client else _("Не указано"))
        owner_value = str(self._deal.owner_id) if self._deal.owner_id else _("Не назначен")
        self._client_labels["owner"].setText(owner_value)

    def _update_documents_tab(self) -> None:
        if not hasattr(self, "_documents_widget"):
            return
        lines = [
            _("Полисов: {}").format(len(self._policies)),
            _("Платежей: {}").format(len(self._payments)),
            _("Для просмотра связанных документов используйте модуль документооборота."),
        ]
        self._documents_widget.setPlainText("\n".join(lines))

    def _update_history_tab(self) -> None:
        if not hasattr(self, "_history_widget"):
            return
        if not self._tasks:
            self._history_widget.setPlainText(_("Нет активности по сделке."))
            return

        sorted_tasks = sorted(
            self._tasks,
            key=lambda task: (task.updated_at or task.created_at or datetime.min),
            reverse=True,
        )
        lines = []
        for task in sorted_tasks[:10]:
            timestamp = self._format_datetime(task.updated_at or task.created_at)
            status = task.status_name or task.status_code or ""
            lines.append(f"{timestamp} — {task.title} [{status}]")
        self._history_widget.setPlainText("\n".join(lines))

    def _update_action_states(self) -> None:
        if self._deal is None:
            return
        if hasattr(self, "_create_policy_button"):
            self._create_policy_button.setEnabled(bool(self._clients))
        if hasattr(self, "_create_payment_button"):
            self._create_payment_button.setEnabled(bool(self._policies))

    def _handle_create_task(self) -> None:
        if self._deal is None:
            return

        dialog = TaskDialog(
            context=self._context,
            clients=self._clients,
            deals=[self._deal],
            policies=self._policies,
            status_options=[policy.status for policy in self._policies if policy.status],
            parent=self,
        )

        deal_index = dialog.deal_combo.findData(self._deal.id)
        if deal_index >= 0:
            dialog.deal_combo.setCurrentIndex(deal_index)
        if self._deal.client_id:
            client_index = dialog.client_combo.findData(self._deal.client_id)
            if client_index >= 0:
                dialog.client_combo.setCurrentIndex(client_index)

        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        payload = dialog.payload()
        if payload is None:
            return

        context_payload = dict(payload.get("context") or {})
        context_payload.setdefault("dealId", str(self._deal.id))
        if self._deal.client_id:
            context_payload.setdefault("clientId", str(self._deal.client_id))
        payload["context"] = context_payload

        try:
            task = self._context.api.create_task(payload)
        except APIClientError as exc:
            QMessageBox.critical(self, _("Создание задачи"), str(exc))
            return

        self._context.update_tasks([task])
        QMessageBox.information(self, _("Success"), _("Task created."))
        self._refresh_related_data()

    def _handle_create_policy(self) -> None:
        if self._deal is None:
            return

        dialog = PolicyDialog(
            context=self._context,
            clients=self._clients,
            deals=[self._deal],
            status_options=[policy.status for policy in self._policies if policy.status],
            parent=self,
        )

        if self._deal.client_id:
            client_index = dialog.client_combo.findData(self._deal.client_id)
            if client_index >= 0:
                dialog.client_combo.setCurrentIndex(client_index)
        deal_index = dialog.deal_combo.findData(self._deal.id)
        if deal_index >= 0:
            dialog.deal_combo.setCurrentIndex(deal_index)

        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        payload = dialog.payload()
        if payload is None:
            return

        payload.setdefault("deal_id", str(self._deal.id))
        if self._deal.client_id:
            payload.setdefault("client_id", str(self._deal.client_id))

        try:
            policy = self._context.api.create_policy(payload)
        except APIClientError as exc:
            QMessageBox.critical(self, _("Добавление полиса"), str(exc))
            return

        self._context.update_policies([policy])
        QMessageBox.information(self, _("Success"), _("Policy created."))
        self._refresh_related_data()

    def _handle_create_payment(self) -> None:
        if self._deal is None:
            return
        if not self._policies:
            QMessageBox.information(self, _("Добавление платежа"), _("Сначала создайте полис для сделки."))
            return

        dialog = PaymentDialog(
            context=self._context,
            policies=self._policies,
            deals=[self._deal],
            parent=self,
        )

        if dialog.policy_combo.count() > 1:
            dialog.policy_combo.setCurrentIndex(1)

        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        payload_info = dialog.create_payload()
        if payload_info is None:
            return

        deal_id, policy_id, payload = payload_info
        try:
            payment = self._context.api.create_payment(deal_id, policy_id, payload)
        except APIClientError as exc:
            QMessageBox.critical(self, _("Добавление платежа"), str(exc))
            return

        QMessageBox.information(self, _("Success"), _("Payment created."))
        self._refresh_related_data()

    def _resolve_client(self, client_id: Optional[UUID]) -> Optional[Client]:
        if client_id is None:
            return None
        for client in self._clients:
            if client.id == client_id:
                return client
        cached = self._context.cache.clients.get(client_id)
        if cached is not None:
            if all(existing.id != client_id for existing in self._clients):
                self._clients.append(cached)
            return cached
        try:
            clients = self._context.api.fetch_clients()
            self._context.update_clients(clients)
            for client in clients:
                if client.id == client_id:
                    if all(existing.id != client_id for existing in self._clients):
                        self._clients.append(client)
                    return client
        except APIClientError:
            return cached
        return cached

    @staticmethod
    def _format_datetime(value: Optional[datetime]) -> str:
        if value is None:
            return _("Не указано")
        return value.strftime("%Y-%m-%d %H:%M")

    @staticmethod
    def _create_table(columns: Sequence[str]) -> QTableWidget:
        table = QTableWidget()
        table.setColumnCount(len(columns))
        table.setHorizontalHeaderLabels(columns)
        table.horizontalHeader().setStretchLastSection(True)
        table.setEditTriggers(QTableWidget.NoEditTriggers)
        table.setSelectionBehavior(QTableWidget.SelectRows)
        table.setSelectionMode(QTableWidget.NoSelection)
        return table

    @staticmethod
    def _populate_table(table: QTableWidget, rows: Sequence[Sequence[str]]) -> None:
        table.setRowCount(len(rows))
        for row_idx, row in enumerate(rows):
            for col_idx, value in enumerate(row):
                item = QTableWidgetItem(value)
                table.setItem(row_idx, col_idx, item)


def _format_money(value: Optional[float]) -> str:
    if value is None:
        return ""
    return f"{value:,.2f}"
