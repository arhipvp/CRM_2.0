from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtWidgets import QApplication

from config import get_settings
from core.app_context import get_app_context, init_app_context
from core.auth_service import AuthService
from logging_config import configure_logging
from ui.dialogs.login_dialog import LoginDialog
from ui.main_window import MainWindow

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def main() -> int:
    settings = get_settings()
    configure_logging(settings)

    app = QApplication.instance() or QApplication(sys.argv)
    _apply_application_style(app)

    # Create authentication service
    auth_service = AuthService(
        base_url=settings.auth_base_url,
        timeout=settings.api_timeout,
    )

    # Show login dialog
    login_dialog = LoginDialog(auth_service=auth_service)
    if login_dialog.exec() != login_dialog.DialogCode.Accepted:
        # User cancelled login
        return 0

    # Initialize app context with authenticated auth service
    init_app_context(settings, auth_service)
    context = get_app_context()

    # Show main window
    window = MainWindow(context=context)
    window.show()
    return app.exec()



def _apply_application_style(app: QApplication) -> None:
    resources_dir = Path(__file__).resolve().parent / "resources"
    style_path = resources_dir / "style.qss"
    if style_path.exists():
        try:
            app.setStyleSheet(style_path.read_text(encoding="utf-8"))
        except OSError:
            pass


if __name__ == "__main__":
    raise SystemExit(main())


