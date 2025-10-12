from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from crm.api.router import get_api_router
from crm.app.config import settings
from crm.app.dependencies import get_session_factory
from crm.app.events import PaymentsEventsSubscriber

logger = logging.getLogger(__name__)


@asynccontextmanager
def lifespan(app: FastAPI):
    subscriber: PaymentsEventsSubscriber | None = None
    if settings.enable_payments_consumer:
        try:
            subscriber = PaymentsEventsSubscriber(settings, get_session_factory())
            await subscriber.start()
            logger.info("Payments events subscriber started")
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to start payments events subscriber: %s", exc)
            subscriber = None
    try:
        yield {"payments_subscriber": subscriber}
    finally:
        if subscriber is not None:
            await subscriber.stop()
            logger.info("Payments events subscriber stopped")


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.include_router(get_api_router(), prefix=settings.api_prefix)

    @app.get("/healthz")
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()


def run() -> None:
    uvicorn.run(
        "crm.app.main:app",
        host="0.0.0.0",
        port=8082,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    run()
