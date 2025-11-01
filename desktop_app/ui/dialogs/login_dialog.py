"""Login dialog for user authentication."""

from __future__ import annotations

import logging
from typing import Optional

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QDialog,
    QLabel,
    QLineEdit,
    QPushButton,
    QVBoxLayout,
    QMessageBox,
)

from core.auth_service import AuthService
from i18n import _

logger = logging.getLogger(__name__)


class LoginDialog(QDialog):
    """Dialog for user login with username and password."""

    def __init__(self, auth_service: AuthService, parent=None) -> None:
        super().__init__(parent)
        self._auth_service = auth_service
        self._setup_ui()

    def _setup_ui(self) -> None:
        """Set up the dialog UI."""
        self.setWindowTitle(_("CRM Desktop - Login"))
        self.setModal(True)
        self.setMinimumWidth(350)
        self.setMinimumHeight(200)

        # Title label
        title_label = QLabel(_("Sign In"), self)
        title_label.setProperty("sectionTitle", True)

        # Email field
        username_label = QLabel(_("Email:"), self)
        self.username_input = QLineEdit(self)
        self.username_input.setPlaceholderText(_("Enter your email address"))
        self.username_input.setFocus()

        # Password field
        password_label = QLabel(_("Password:"), self)
        self.password_input = QLineEdit(self)
        self.password_input.setPlaceholderText(_("Enter your password"))
        self.password_input.setEchoMode(QLineEdit.EchoMode.Password)

        # Error message label (initially hidden)
        self.error_label = QLabel("", self)
        self.error_label.setProperty("error", True)
        self.error_label.setStyleSheet("color: red;")
        self.error_label.setVisible(False)

        # Login button
        self.login_button = QPushButton(_("Sign In"), self)
        self.login_button.clicked.connect(self._handle_login)  # type: ignore[arg-type]
        self.login_button.setDefault(True)

        # Exit button
        self.exit_button = QPushButton(_("Exit"), self)
        self.exit_button.clicked.connect(self.reject)  # type: ignore[arg-type]

        # Layout
        layout = QVBoxLayout(self)
        layout.addWidget(title_label)
        layout.addSpacing(20)
        layout.addWidget(username_label)
        layout.addWidget(self.username_input)
        layout.addWidget(password_label)
        layout.addWidget(self.password_input)
        layout.addWidget(self.error_label)
        layout.addSpacing(20)
        layout.addWidget(self.login_button)
        layout.addWidget(self.exit_button)

        # Connect Enter key to login
        self.username_input.returnPressed.connect(self._handle_login)  # type: ignore[arg-type]
        self.password_input.returnPressed.connect(self._handle_login)  # type: ignore[arg-type]

    def _handle_login(self) -> None:
        """Handle login button click."""
        username = self.username_input.text().strip()
        password = self.password_input.text()

        # Validate input
        if not username or not password:
            self._show_error(_("Please enter username and password"))
            return

        # Disable button during login
        self.login_button.setEnabled(False)
        self.login_button.setText(_("Signing in..."))

        try:
            # Attempt authentication
            if self._auth_service.login(username, password):
                logger.info("Login successful for user: %s", username)
                self.accept()
            else:
                self._show_error(_("Invalid username or password"))
                self.password_input.clear()
                self.password_input.setFocus()
        except Exception as exc:
            logger.error("Login error: %s", exc)
            self._show_error(_("Login failed: {}").format(exc))
        finally:
            self.login_button.setEnabled(True)
            self.login_button.setText(_("Sign In"))

    def _show_error(self, message: str) -> None:
        """Display error message to user."""
        self.error_label.setText(message)
        self.error_label.setVisible(True)
        logger.warning("Login error shown: %s", message)

    def get_auth_service(self) -> Optional[AuthService]:
        """Get authenticated auth service after successful login."""
        if self.result() == QDialog.DialogCode.Accepted:
            return self._auth_service
        return None
