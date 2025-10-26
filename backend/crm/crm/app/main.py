from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory
from alembic.script.revision import RangeNotAncestorError, ResolutionError
from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

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
from crm.infrastructure.db import AsyncSessionFactory
from crm.infrastructure.task_events import TaskEventsPublisher

logger = logging.getLogger(__name__)

REQUIRED_REVISION = "2024052801_add_next_review_at_to_deals"
MIGRATIONS_REQUIRED_MESSAGE = (
    "CRM сервис недоступен: примените миграции базы данных "
    "(`poetry run alembic upgrade head`)."
)


def _get_script_directory() -> ScriptDirectory:
    base_dir = Path(__file__).resolve().parents[2]
    config = AlembicConfig(str(base_dir / "alembic.ini"))
    config.set_main_option("script_location", str(base_dir / "migrations"))
    return ScriptDirectory.from_config(config)


async def _check_database_revision() -> tuple[bool, str | None]:
    script_directory = _get_script_directory()

    try:
        script_directory.get_revision(REQUIRED_REVISION)
    except ResolutionError as exc:  # pragma: no cover - configuration error
        logger.exception("Required Alembic revision is missing: %s", exc)
        return False, (
            "CRM сервис недоступен: обязательная ревизия Alembic отсутствует в кодовой базе."
        )

    try:
        async with AsyncSessionFactory() as session:
            result = await session.execute(text("SELECT version_num FROM crm.alembic_version"))
    except SQLAlchemyError as exc:
        logger.warning("Failed to read Alembic version from database: %s", exc)
        return False, MIGRATIONS_REQUIRED_MESSAGE

    revisions = {row[0] for row in result if row[0]}
    if not revisions:
        logger.warning("Alembic version table is empty or missing.")
        return False, MIGRATIONS_REQUIRED_MESSAGE

    if len(revisions) > 1:
        logger.warning("Multiple Alembic revisions detected: %s", ", ".join(sorted(revisions)))
        return False, MIGRATIONS_REQUIRED_MESSAGE

    current_revision = revisions.pop()

    try:
        script_directory.get_revision(current_revision)
    except ResolutionError:
        logger.warning("Unknown Alembic revision %s present in database.", current_revision)
        return False, (
            "CRM сервис недоступен: версия базы данных не соответствует коду. "
            "Обновите репозиторий или выполните `poetry run alembic upgrade head`."
        )

    if current_revision == REQUIRED_REVISION:
        return True, None

    try:
        missing_chain = list(script_directory.iterate_revisions(REQUIRED_REVISION, current_revision))
    except RangeNotAncestorError:
        missing_chain = []

    if missing_chain:
        logger.warning(
            "Database revision %s is behind required %s.", current_revision, REQUIRED_REVISION
        )
        return False, (
            f"CRM сервис недоступен: текущая ревизия базы данных ({current_revision}) "
            f"уступает обязательной ({REQUIRED_REVISION}). Выполните `poetry run alembic upgrade head`."
        )

    return True, None


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.events_publisher = None
    app.state.task_events_publisher = None
    app.state.notification_consumer = None

    migrations_ok, error_message = await _check_database_revision()
    app.state.migrations_ok = migrations_ok
    app.state.migrations_error = error_message

    if not migrations_ok:
        logger.error("CRM API is unavailable: %s", error_message)
        yield {}
        return

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
    app.state.migrations_ok = True
    app.state.migrations_error = None
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    @app.middleware("http")
    async def ensure_migrations(request: Request, call_next):
        if not getattr(app.state, "migrations_ok", True):
            detail = getattr(app.state, "migrations_error", MIGRATIONS_REQUIRED_MESSAGE)
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"detail": detail},
            )
        return await call_next(request)

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
