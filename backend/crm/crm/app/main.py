from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from crm.api.router import get_api_router
from crm.api.routers import notification_events
from crm.api.streams import streams_endpoint
from crm.app.config import settings
from crm.app.dependencies import (
    close_notification_dependencies,
    close_permissions_queue,
    close_task_queues,
    get_notification_stream,
    get_telegram_service,
)
from crm.app.notifications_consumer import NotificationQueueConsumer
from crm.app.events import EventsPublisher
from crm.infrastructure.task_events import TaskEventsPublisher

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    publisher = EventsPublisher(settings)
    task_publisher = TaskEventsPublisher(settings)
    try:
        await publisher.connect()
        app.state.events_publisher = publisher
        logger.info("Events publisher connected")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to start events publisher: %s", exc)
        app.state.events_publisher = None
    try:
        await task_publisher.connect()
        app.state.task_events_publisher = task_publisher
        logger.info("Task events publisher connected")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to start task events publisher: %s", exc)
        app.state.task_events_publisher = None
    notification_consumer: NotificationQueueConsumer | None = None
    try:
        stream = get_notification_stream()
        telegram = get_telegram_service()
        notification_consumer = NotificationQueueConsumer(settings, stream, telegram)
        await notification_consumer.start()
        app.state.notification_consumer = notification_consumer
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to start notification consumer: %s", exc)
        app.state.notification_consumer = None
    try:
        yield {"events_publisher": app.state.events_publisher}
    finally:
        publisher_instance = app.state.events_publisher
        if isinstance(publisher_instance, EventsPublisher):
            await publisher_instance.close()
            logger.info("Events publisher disconnected")
        task_publisher_instance = getattr(app.state, "task_events_publisher", None)
        if isinstance(task_publisher_instance, TaskEventsPublisher):
            await task_publisher_instance.close()
            logger.info("Task events publisher disconnected")
        consumer_instance = getattr(app.state, "notification_consumer", None)
        if isinstance(consumer_instance, NotificationQueueConsumer):
            await consumer_instance.stop()
        await close_permissions_queue()
        await close_task_queues()
        await close_notification_dependencies()


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(get_api_router(), prefix=settings.api_prefix)
    app.include_router(notification_events.router, prefix="/api")

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
