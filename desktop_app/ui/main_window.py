from __future__ import annotations

import logging

from PySide6.QtCore import Qt
from PySide6.QtGui import QAction
from PySide6.QtWidgets import (
    QMainWindow,
    QMenu,
    QMenuBar,
    QMessageBox,
    QStatusBar,
    QTabWidget,
)

from core.app_context import AppContext, get_app_context
from i18n import _
from ui.tabs.clients_tab import ClientsTab
from ui.tabs.deals_tab import DealsTab
from ui.tabs.finance_tab import FinanceTab
from ui.tabs.home_tab import HomeTab
from ui.tabs.policies_tab import PoliciesTab
from ui.tabs.tasks_tab import TasksTab

logger = logging.getLogger(__name__)


class MainWindow(QMainWindow):
    def __init__(self, *, context: AppContext | None = None, parent=None) -> None:
        super().__init__(parent)
        self._context = context or get_app_context()

        self.setWindowTitle(_("CRM Desktop"))
        self.resize(1280, 800)
        self.setMinimumSize(900, 600)

        self.status_bar = QStatusBar(self)
        self.setStatusBar(self.status_bar)

        self.tab_widget = QTabWidget(self)
        self.setCentralWidget(self.tab_widget)

        self._init_menu_bar()
        self._init_tabs()

    def _init_menu_bar(self) -> None:
        menu_bar = QMenuBar(self)
        self.setMenuBar(menu_bar)

        file_menu = QMenu(_("File"), self)
        exit_action = QAction(_("Exit"), self)
        exit_action.triggered.connect(self.close)  # type: ignore[arg-type]
        file_menu.addAction(exit_action)
        menu_bar.addMenu(file_menu)

        view_menu = QMenu(_("View"), self)
        refresh_action = QAction(_("Refresh current tab"), self)
        refresh_action.setShortcut("F5")
        refresh_action.triggered.connect(self.refresh_current_tab)  # type: ignore[arg-type]
        view_menu.addAction(refresh_action)
        menu_bar.addMenu(view_menu)

    def _init_tabs(self) -> None:
        self.home_tab = HomeTab(context=self._context, parent=self)
        self.clients_tab = ClientsTab(context=self._context, parent=self)
        self.deals_tab = DealsTab(context=self._context, parent=self)
        self.policies_tab = PoliciesTab(context=self._context, parent=self)
        self.finance_tab = FinanceTab(context=self._context, parent=self)
        self.tasks_tab = TasksTab(context=self._context, parent=self)

        self.tab_widget.addTab(self.home_tab, _("Dashboard"))
        self.tab_widget.addTab(self.clients_tab, _("Clients"))
        self.tab_widget.addTab(self.deals_tab, _("Deals"))
        self.tab_widget.addTab(self.policies_tab, _("Policies"))
        self.tab_widget.addTab(self.finance_tab, _("Finance"))
        self.tab_widget.addTab(self.tasks_tab, _("Tasks"))

        for tab in (
            self.clients_tab,
            self.deals_tab,
            self.policies_tab,
            self.finance_tab,
            self.tasks_tab,
        ):
            tab.data_loaded.connect(self._on_tab_data_loaded)

        self.tab_widget.currentChanged.connect(self._on_tab_changed)  # type: ignore[arg-type]

    def refresh_current_tab(self) -> None:
        widget = self.tab_widget.currentWidget()
        if hasattr(widget, "load_data"):
            try:
                widget.load_data()  # type: ignore[call-arg] - runtime check
            except Exception as exc:  # pragma: no cover - unexpected errors
                logger.exception("Refresh error: %s", exc)
                QMessageBox.critical(self, _("Error"), str(exc))

    # ----- signals ----------------------------------------------------------
    def _on_tab_data_loaded(self, count: int) -> None:
        self.status_bar.showMessage(_("Rows loaded: {}").format(count), 5000)

    def _on_tab_changed(self, index: int) -> None:
        widget = self.tab_widget.widget(index)
        if widget is self.home_tab:
            self.home_tab.refresh_stats()
        elif hasattr(widget, "load_data"):
            widget.load_data()

    # ----- lifecycle --------------------------------------------------------
    def closeEvent(self, event) -> None:  # type: ignore[override]
        try:
            self._context.close()
        finally:
            super().closeEvent(event)

