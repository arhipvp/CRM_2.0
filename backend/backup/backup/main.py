from __future__ import annotations

from fastapi import FastAPI

from .api.routes import router
from .config import Settings, get_settings
from .db import RepositoryFactory
from .executors.consul import build_consul_snapshot_executor
from .executors.postgres import build_pg_basebackup_executor, build_pg_dump_executor
from .executors.rabbitmq import build_rabbitmq_export_executor
from .executors.redis import build_redis_backup_executor
from .notifications import NotificationPublisher
from .service import BackupService
from .storage import S3Storage


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(title="Backup Service", version="0.1.0")

    repository_factory = RepositoryFactory(settings)
    storage = S3Storage(settings)
    publisher = NotificationPublisher(settings)
    service = BackupService(settings, repository_factory, storage, publisher)
    service.register_executor("postgres.pg_dump", build_pg_dump_executor(settings))
    service.register_executor("postgres.pg_basebackup", build_pg_basebackup_executor(settings))
    service.register_executor("consul.snapshot", build_consul_snapshot_executor(settings))
    service.register_executor("rabbitmq.export", build_rabbitmq_export_executor(settings))
    service.register_executor("redis.snapshot", build_redis_backup_executor(settings))

    @app.on_event("startup")
    async def startup_event() -> None:
        await service.startup()
        app.state.backup_service = service
        app.state.repository_factory = repository_factory
        app.state.storage = storage
        app.state.publisher = publisher

    @app.on_event("shutdown")
    async def shutdown_event() -> None:
        await service.shutdown()

    app.include_router(router)

    return app
__all__ = ["create_app"]
