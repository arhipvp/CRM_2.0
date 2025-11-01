from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QLabel, QPushButton, QVBoxLayout, QWidget

from api.client import APIClientError
from core.app_context import AppContext
from models import StatCounters


class HomeTab(QWidget):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(parent)
        self._context = context
        self._stats = StatCounters()

        self.header_label = QLabel("Quick stats", self)
        self.header_label.setProperty("sectionTitle", True)

        self.clients_label = QLabel("", self)
        self.deals_label = QLabel("", self)
        self.policies_label = QLabel("", self)
        self.tasks_label = QLabel("", self)

        for label in (
            self.clients_label,
            self.deals_label,
            self.policies_label,
            self.tasks_label,
        ):
            label.setAlignment(Qt.AlignmentFlag.AlignLeft)
            label.setProperty("statLabel", True)

        self.refresh_button = QPushButton("Refresh", self)
        self.refresh_button.clicked.connect(self.refresh_stats)  # type: ignore[arg-type]

        layout = QVBoxLayout(self)
        layout.addWidget(self.header_label)
        layout.addWidget(self.clients_label)
        layout.addWidget(self.deals_label)
        layout.addWidget(self.policies_label)
        layout.addWidget(self.tasks_label)
        layout.addStretch(1)
        layout.addWidget(self.refresh_button, alignment=Qt.AlignmentFlag.AlignRight)

        self.refresh_stats()

    def refresh_stats(self) -> None:
        try:
            self._stats = self._context.api.fetch_stats()
        except APIClientError:
            pass
        self._render()

    def _render(self) -> None:
        self.clients_label.setText(f"Clients: {self._stats.clients}")
        self.deals_label.setText(f"Deals: {self._stats.deals}")
        self.policies_label.setText(f"Policies: {self._stats.policies}")
        self.tasks_label.setText(f"Tasks: {self._stats.tasks}")

