from __future__ import annotations

from datetime import date
from typing import Dict, Iterable, Optional

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
)

from api.client import APIClientError
from core.app_context import AppContext
from models import Client, Deal
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

