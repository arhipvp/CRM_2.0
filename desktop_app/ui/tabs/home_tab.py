from __future__ import annotations

import logging
from typing import Any

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import QLabel, QPushButton, QVBoxLayout, QWidget

from api.client import APIClientError
from core.app_context import AppContext
from models import StatCounters
from ui.worker import Worker, WorkerPool

logger = logging.getLogger(__name__)


class HomeTab(QWidget):
    # Signal to allow main window to refresh stats when tab becomes active
    stats_refreshing = Signal()

    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(parent)
        self._context = context
        self._stats = StatCounters()
        self._worker_pool = WorkerPool()

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
        """Load stats from API in background thread."""
        if self._worker_pool.is_running("load_stats"):
            logger.debug("Stats load already in progress")
            return

        self.refresh_button.setEnabled(False)
        self.refresh_button.setText("Loading...")

        def load_stats_task() -> StatCounters:
            return self._context.api.fetch_stats()

        worker = Worker(load_stats_task)
        worker.finished.connect(self._on_stats_loaded)  # type: ignore[arg-type]
        worker.error.connect(self._on_stats_error)  # type: ignore[arg-type]
        self._worker_pool.start("load_stats", worker)

    def _on_stats_loaded(self, stats: Any) -> None:
        """Handle successful stats load.

        Args:
            stats: StatCounters object from API
        """
        self.refresh_button.setEnabled(True)
        self.refresh_button.setText("Refresh")

        if isinstance(stats, StatCounters):
            self._stats = stats
            logger.debug("Stats loaded: %s", stats)
        else:
            logger.error("Invalid stats type: %s", type(stats))

        self._render()

    def _on_stats_error(self, error_message: str) -> None:
        """Handle stats load error.

        Args:
            error_message: Error description
        """
        self.refresh_button.setEnabled(True)
        self.refresh_button.setText("Refresh")
        logger.error("Stats load error: %s", error_message)
        # Show current stats anyway, even if load failed

    def _render(self) -> None:
        """Render stats on the UI."""
        self.clients_label.setText(f"Clients: {self._stats.clients}")
        self.deals_label.setText(f"Deals: {self._stats.deals}")
        self.policies_label.setText(f"Policies: {self._stats.policies}")
        self.tasks_label.setText(f"Tasks: {self._stats.tasks}")
