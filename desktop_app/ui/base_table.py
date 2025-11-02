from __future__ import annotations

import logging
from typing import Iterable, Sequence

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QStandardItem, QStandardItemModel
from PySide6.QtWidgets import (
    QHBoxLayout,
    QMessageBox,
    QPushButton,
    QSizePolicy,
    QTableView,
    QVBoxLayout,
    QWidget,
)

from i18n import _

logger = logging.getLogger(__name__)


class BaseTableTab(QWidget):
    data_loaded = Signal(int)
    data_loading = Signal(bool)  # True = loading started, False = loading finished
    operation_error = Signal(str)  # Error message

    def __init__(
        self,
        *,
        columns: Sequence[str],
        title: str | None = None,
        parent=None,
        enable_add: bool = True,
        enable_edit: bool = True,
        enable_delete: bool = True,
    ) -> None:
        super().__init__(parent)
        self._columns = columns
        self._title = title or ""
        self._model = QStandardItemModel(self)
        self._model.setHorizontalHeaderLabels(list(columns))

        self.table = QTableView(self)
        self.table.setModel(self._model)
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setSelectionBehavior(QTableView.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QTableView.SelectionMode.SingleSelection)
        self.table.setAlternatingRowColors(True)
        self.table.setEditTriggers(QTableView.EditTrigger.NoEditTriggers)
        self.table.selectionModel().selectionChanged.connect(self._update_action_state)

        self.add_button = QPushButton(_("Добавить"), self)
        self.edit_button = QPushButton(_("Изменить"), self)
        self.delete_button = QPushButton(_("Удалить"), self)
        self.refresh_button = QPushButton(_("Обновить"), self)

        for button in (
            self.add_button,
            self.edit_button,
            self.delete_button,
            self.refresh_button,
        ):
            button.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)

        header_layout = QHBoxLayout()
        header_layout.addWidget(self.add_button)
        header_layout.addWidget(self.edit_button)
        header_layout.addWidget(self.delete_button)
        header_layout.addStretch(1)
        header_layout.addWidget(self.refresh_button)

        layout = QVBoxLayout(self)
        layout.addLayout(header_layout)
        layout.addWidget(self.table)

        self.add_button.clicked.connect(self._handle_add)  # type: ignore[arg-type]
        self.edit_button.clicked.connect(self._handle_edit)  # type: ignore[arg-type]
        self.delete_button.clicked.connect(self._handle_delete)  # type: ignore[arg-type]
        self.refresh_button.clicked.connect(self.refresh)  # type: ignore[arg-type]

        # Connect loading state signals
        self.data_loading.connect(self._on_loading_state_changed)  # type: ignore[arg-type]
        self.operation_error.connect(self._on_operation_error)  # type: ignore[arg-type]

        self.set_action_visibility(add=enable_add, edit=enable_edit, delete=enable_delete)
        self._update_action_state()

    # ----- hooks ------------------------------------------------------------
    def load_data(self) -> None:
        """To be implemented in subclasses."""

    def refresh(self) -> None:
        self.load_data()

    def on_add(self) -> None:
        QMessageBox.information(self, _("Действие недоступно"), _("Функция ещё не реализована."))

    def on_edit(self, index: int, row: Sequence[str]) -> None:
        QMessageBox.information(self, _("Действие недоступно"), _("Функция ещё не реализована."))

    def on_delete(self, index: int, row: Sequence[str]) -> None:
        QMessageBox.information(self, _("Действие недоступно"), _("Функция ещё не реализована."))

    # ----- handlers ---------------------------------------------------------
    def _handle_add(self) -> None:
        self.on_add()

    def _handle_edit(self) -> None:
        index = self.get_selected_index()
        if index is None:
            QMessageBox.warning(self, _("Нужен выбор строки"), _("Выберите запись для изменения."))
            return
        row = self.get_selected_row_values(index)
        self.on_edit(index, row)

    def _handle_delete(self) -> None:
        index = self.get_selected_index()
        if index is None:
            QMessageBox.warning(self, _("Нужен выбор строки"), _("Выберите запись для удаления."))
            return
        row = self.get_selected_row_values(index)
        self.on_delete(index, row)

    # ----- population -------------------------------------------------------
    def populate(self, rows: Iterable[Sequence[str]]) -> None:
        self._model.setRowCount(0)
        for row_idx, row in enumerate(rows):
            items = [self._create_item(value) for value in row]
            self._model.insertRow(row_idx, items)
        self.data_loaded.emit(self._model.rowCount())
        self._update_action_state()

    def get_selected_index(self) -> int | None:
        selected = self.table.selectionModel().selectedRows()
        if not selected:
            return None
        return selected[0].row()

    def get_selected_row_values(self, row_index: int) -> Sequence[str]:
        return [
            self._model.item(row_index, column).text()
            if self._model.item(row_index, column) is not None
            else ""
            for column in range(self._model.columnCount())
        ]

    @staticmethod
    def _create_item(value: str | None) -> QStandardItem:
        item = QStandardItem(str(value) if value is not None else "")
        item.setEditable(False)
        item.setData(item.text(), Qt.ItemDataRole.ToolTipRole)
        return item

    def _update_action_state(self) -> None:
        has_selection = bool(self.table.selectionModel().selectedRows())
        if self.edit_button.isVisible():
            self.edit_button.setEnabled(has_selection)
        if self.delete_button.isVisible():
            self.delete_button.setEnabled(has_selection)

    def set_action_visibility(self, *, add: bool, edit: bool, delete: bool) -> None:
        self.add_button.setVisible(add)
        self.edit_button.setVisible(edit)
        self.delete_button.setVisible(delete)
        self._update_action_state()

    # ----- signal handlers --------------------------------------------------
    def _on_loading_state_changed(self, is_loading: bool) -> None:
        """Handle loading state changes.

        Args:
            is_loading: True if loading started, False if finished
        """
        self.add_button.setEnabled(not is_loading)
        self.edit_button.setEnabled(not is_loading)
        self.delete_button.setEnabled(not is_loading)
        self.refresh_button.setEnabled(not is_loading)
        self.table.setEnabled(not is_loading)

        if is_loading:
            self.refresh_button.setText(_("Загрузка..."))
        else:
            self.refresh_button.setText(_("Обновить"))

    def _on_operation_error(self, error_message: str) -> None:
        """Handle operation errors.

        Args:
            error_message: Description of error
        """
        logger.error("Operation error: %s", error_message)
        QMessageBox.critical(self, _("Error"), _("Operation failed: {}").format(error_message))
