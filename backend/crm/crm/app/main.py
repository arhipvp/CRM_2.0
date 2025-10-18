from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import Depends, FastAPI
from sse_starlette.sse import EventSourceResponse

from crm.api.router import get_api_router
from crm.api.streams import streams_endpoint
from crm.app.config import settings
from crm.app.dependencies import close_permissions_queue
from crm.app.events import EventsPublisher

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    publisher = EventsPublisher(settings)
    try:
        await publisher.connect()
        app.state.events_publisher = publisher
        logger.info("Events publisher connected")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to start events publisher: %s", exc)
        app.state.events_publisher = None
    try:
        yield {"events_publisher": app.state.events_publisher}
    finally:
        publisher_instance = app.state.events_publisher
        if isinstance(publisher_instance, EventsPublisher):
            await publisher_instance.close()
            logger.info("Events publisher disconnected")
        await close_permissions_queue()


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.include_router(get_api_router(), prefix=settings.api_prefix)

    @app.get("/healthz")
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/streams", include_in_schema=False)
    async def streams_route(response=Depends(streams_endpoint)) -> EventSourceResponse:
        return response

    return app


app = create_app()


def run() -> None:
    uvicorn.run(
        "crm.app.main:app",
        host=settings.service_host,
        port=settings.service_port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    run()
