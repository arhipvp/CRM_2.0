from __future__ import annotations

import uvicorn

from telegram_bot.app import create_app
from telegram_bot.config import get_settings


def run() -> None:
    settings = get_settings()
    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=settings.service_port)


if __name__ == "__main__":
    run()
