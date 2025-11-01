from __future__ import annotations

from typing import Iterable, Sequence

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QStandardItem, QStandardItemModel
from PySide6.QtWidgets import (
    QHBoxLayout,
    QPushButton,
    QSizePolicy,
    QTableView,
    QVBoxLayout,
    QWidget,
)


class BaseTableTab(QWidget):
    data_loaded = Signal(int)

    def __init__(self, *, columns: Sequence[str], title: str | None = None, parent=None) -> None:
        super().__init__(parent)
        self._columns = columns
        self._title = title or ""
        self._model = QStandardItemModel(self)
        self._model.setHorizontalHeaderLabels([col.title() for col in columns])

        self.table = QTableView(self)
        self.table.setModel(self._model)
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setSelectionBehavior(QTableView.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)
        self.table.setEditTriggers(QTableView.EditTrigger.NoEditTriggers)

        self.refresh_button = QPushButton("Обновить", self)
        self.refresh_button.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)

        header_layout = QHBoxLayout()
        header_layout.addStretch(1)
        header_layout.addWidget(self.refresh_button)

        layout = QVBoxLayout(self)
        layout.addLayout(header_layout)
        layout.addWidget(self.table)

        self.refresh_button.clicked.connect(self.refresh)  # type: ignore[arg-type]

    # ----- hooks ------------------------------------------------------------
    def load_data(self) -> None:
        """To be implemented in subclasses."""

    def refresh(self) -> None:
        self.load_data()

    # ----- population -------------------------------------------------------
    def populate(self, rows: Iterable[Sequence[str]]) -> None:
        self._model.setRowCount(0)
        for row_idx, row in enumerate(rows):
            items = [self._create_item(value) for value in row]
            self._model.insertRow(row_idx, items)
        self.data_loaded.emit(self._model.rowCount())

    @staticmethod
    def _create_item(value: str | None) -> QStandardItem:
        item = QStandardItem(str(value) if value is not None else "")
        item.setEditable(False)
        item.setData(item.text(), Qt.ItemDataRole.ToolTipRole)
        return item

