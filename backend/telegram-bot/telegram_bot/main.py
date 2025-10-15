from __future__ import annotations

import uvicorn

from telegram_bot.app import create_app


def run() -> None:
    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=8089)


if __name__ == "__main__":
    run()
