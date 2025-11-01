from __future__ import annotations

from datetime import date
from typing import Dict, Iterable, Optional, Sequence

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
        self.setWindowTitle("New deal" if deal is None else "Edit deal")
        self._context = context
        self._deal = deal

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

        self.add_client_button = QPushButton("Add client", self)
        self.add_client_button.clicked.connect(self._handle_add_client)

        client_row = QWidget(self)
        row_layout = QHBoxLayout(client_row)
        row_layout.setContentsMargins(0, 0, 0, 0)
        row_layout.addWidget(self.client_combo, 1)
        row_layout.addWidget(self.add_client_button)

        form = QFormLayout(self)
        form.addRow("Title *", self.title_edit)
        form.addRow("Description", self.description_edit)
        form.addRow("Status", self.status_combo)
        form.addRow("Next review *", self.next_review_edit)
        form.addRow("Client *", client_row)

        self.tabs: Optional[QTabWidget] = None

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

            self.tabs = QTabWidget(self)
            form.addRow(self.tabs)
            self._init_related_tabs(deal)

    def _handle_add_client(self) -> None:
        dialog = ClientDialog(parent=self)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return
        try:
            client = self._context.api.create_client(dialog.payload())
        except APIClientError as exc:
            QMessageBox.critical(self, "Create client", str(exc))
            return

        self._context.update_clients([client])
        self._clients.append(client)
        self.client_combo.addItem(client.name, client.id)
        self.client_combo.setCurrentIndex(self.client_combo.count() - 1)

    def _on_accept(self) -> None:
        if not self.title_edit.text().strip():
            QMessageBox.warning(self, "Validation", "Enter a deal title.")
            return
        if self.client_combo.currentIndex() < 0:
            QMessageBox.warning(self, "Validation", "Select a client.")
            return
        if not self.next_review_edit.date().isValid():
            QMessageBox.warning(self, "Validation", "Select a review date.")
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
    def _init_related_tabs(self, deal: Deal) -> None:
        assert self.tabs is not None

        self._policies_table = self._create_table(
            ["Policy", "Status", "Premium", "From", "To"]
        )
        self.tabs.addTab(self._policies_table, "Policies")

        self._payments_table = self._create_table(
            ["Policy", "Seq", "Status", "Planned date", "Planned amount"]
        )
        self.tabs.addTab(self._payments_table, "Payments")

        self._tasks_table = self._create_table(
            ["Title", "Status", "Due", "Assignee"]
        )
        self.tabs.addTab(self._tasks_table, "Tasks")

        self._finance_table = self._create_table(
            ["Policy", "Incomes", "Expenses", "Net"]
        )
        self.tabs.addTab(self._finance_table, "Finance")

        self._load_related_data(deal)

    def _load_related_data(self, deal: Deal) -> None:
        try:
            policies = [
                policy
                for policy in self._context.api.fetch_policies()
                if policy.deal_id == deal.id
            ]
        except APIClientError as exc:
            QMessageBox.warning(self, "Load policies", str(exc))
            policies = []

        self._populate_table(
            self._policies_table,
            [
                (
                    policy.policy_number,
                    policy.status or "",
                    _format_money(policy.premium),
                    policy.effective_from.isoformat()
                    if policy.effective_from
                    else "",
                    policy.effective_to.isoformat() if policy.effective_to else "",
                )
                for policy in policies
            ],
        )

        payments: list[Payment] = []
        for policy in policies:
            try:
                payments.extend(
                    self._context.api.fetch_payments(deal.id, policy.id)
                )
            except APIClientError:
                continue

        policy_map: Dict[UUID, str] = {policy.id: policy.policy_number for policy in policies}
        self._populate_table(
            self._payments_table,
            [
                (
                    policy_map.get(payment.policy_id, ""),
                    str(payment.sequence),
                    payment.status or "",
                    payment.planned_date.isoformat() if payment.planned_date else "",
                    _format_money(payment.planned_amount),
                )
                for payment in payments
            ],
        )

        try:
            tasks = [
                task
                for task in self._context.api.fetch_tasks()
                if task.deal_id == deal.id
            ]
        except APIClientError as exc:
            QMessageBox.warning(self, "Load tasks", str(exc))
            tasks = []

        self._populate_table(
            self._tasks_table,
            [
                (
                    task.title,
                    task.status_name or task.status_code or "",
                    task.due_at.strftime("%Y-%m-%d %H:%M") if task.due_at else "",
                    str(task.assignee_id or "")[:8],
                )
                for task in tasks
            ],
        )

        finance_rows = []
        for policy in policies:
            policy_payments = [
                payment for payment in payments if payment.policy_id == policy.id
            ]
            incomes = sum(payment.incomes_total or 0 for payment in policy_payments)
            expenses = sum(payment.expenses_total or 0 for payment in policy_payments)
            net = sum(payment.net_total or 0 for payment in policy_payments)
            finance_rows.append(
                (
                    policy.policy_number,
                    _format_money(incomes),
                    _format_money(expenses),
                    _format_money(net),
                )
            )
        self._populate_table(self._finance_table, finance_rows)

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

