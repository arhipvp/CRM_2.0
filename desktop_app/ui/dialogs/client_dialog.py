from __future__ import annotations

from typing import Dict, Optional

from PySide6.QtWidgets import (
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QLineEdit,
    QMessageBox,
)

from models import Client
from i18n import _


class ClientDialog(QDialog):
    def __init__(self, *, parent=None, client: Client | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Новый клиент" if client is None else "Редактирование клиента")
        self._client = client

        self.name_edit = QLineEdit(self)
        self.email_edit = QLineEdit(self)
        self.phone_edit = QLineEdit(self)
        self.status_edit = QLineEdit(self)

        form = QFormLayout(self)
        form.addRow("Название *", self.name_edit)
        form.addRow(_("Email"), self.email_edit)
        form.addRow("Телефон", self.phone_edit)
        form.addRow("Статус", self.status_edit)

        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            parent=self,
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        form.addRow(buttons)

        if client is not None:
            self.name_edit.setText(client.name)
            if client.email:
                self.email_edit.setText(client.email)
            if client.phone:
                self.phone_edit.setText(client.phone)
            if client.status:
                self.status_edit.setText(client.status)

        if not self.status_edit.text():
            self.status_edit.setText(_("active"))

    def _on_accept(self) -> None:
        if not self.name_edit.text().strip():
            QMessageBox.warning(self, "Проверка данных", "Введите название клиента.")
            return
        self.accept()

    def payload(self) -> Dict[str, Optional[str]]:
        return {
            "name": self.name_edit.text().strip(),
            "email": self.email_edit.text().strip() or None,
            "phone": self.phone_edit.text().strip() or None,
            "status": self.status_edit.text().strip() or "active",
        }

