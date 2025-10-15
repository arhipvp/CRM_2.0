from __future__ import annotations

import asyncio
import importlib
import os
import sys
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from uuid import uuid4

import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

try:  # pragma: no cover - optional dependency guard
    from testcontainers.rabbitmq import RabbitMqContainer
except ModuleNotFoundError:  # pragma: no cover - optional dependency guard
    RabbitMqContainer = None  # type: ignore[assignment]


BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

os.environ.setdefault("CRM_DATABASE_URL", "https://example.com/database")
os.environ.setdefault("CRM_REDIS_URL", "https://example.com/redis")
os.environ.setdefault("CRM_RABBITMQ_URL", "https://example.com/rabbitmq")
os.environ.setdefault("CRM_PERMISSIONS_REDIS_URL", "https://example.com/redis")
os.environ.setdefault("CRM_PERMISSIONS_QUEUE_NAME", "permissions:sync")
os.environ.setdefault("CRM_PERMISSIONS_QUEUE_PREFIX", "bull")
os.environ.setdefault("CRM_PERMISSIONS_JOB_NAME", "permissions.sync")
os.environ.setdefault("CRM_DOCUMENTS_BASE_URL", "https://example.com/documents")

@pytest.fixture(scope="session")
def event_loop() -> Iterator[asyncio.AbstractEventLoop]:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def postgres() -> Iterator[PostgresContainer]:
    container = PostgresContainer("postgres:15-alpine")
    container.start()
    try:
        yield container
    finally:
        container.stop()


@pytest.fixture(scope="session")
def redis() -> Iterator[RedisContainer]:
    container = RedisContainer("redis:7-alpine")
    container.start()
    try:
        yield container
    finally:
        container.stop()


@pytest.fixture(scope="session")
def rabbitmq() -> Iterator[RabbitMqContainer]:
    if RabbitMqContainer is None:
        pytest.skip("RabbitMQ test container dependencies are not installed")

    container = RabbitMqContainer("rabbitmq:3.12-management")
    container.start()
    try:
        yield container
    finally:
        container.stop()


@pytest.fixture(scope="session")
def configure_environment(postgres: PostgresContainer, redis: RedisContainer, rabbitmq: RabbitMqContainer):
    db_url = postgres.get_connection_url()
    os.environ["CRM_DATABASE_URL"] = db_url
    os.environ["CRM_REDIS_URL"] = redis.get_connection_url()
    os.environ["CRM_PERMISSIONS_REDIS_URL"] = os.environ["CRM_REDIS_URL"]
    os.environ["CRM_RABBITMQ_URL"] = rabbitmq.get_connection_url()
    os.environ.setdefault("CRM_CELERY_BROKER_URL", os.environ["CRM_REDIS_URL"])
    os.environ.setdefault("CRM_CELERY_RESULT_BACKEND", os.environ["CRM_REDIS_URL"])
    os.environ.setdefault("CRM_DEFAULT_TENANT_ID", str(uuid4()))

    from crm.app import config as app_config

    app_config.get_settings.cache_clear()
    app_config.settings = app_config.get_settings()

    db_module = importlib.import_module("crm.infrastructure.db")
    importlib.reload(db_module)
    return app_config.settings


@pytest.fixture(scope="session")
def apply_migrations(configure_environment):
    cfg = Config(str(Path("backend/crm/alembic.ini")))
    cfg.set_main_option("script_location", str(Path("backend/crm/migrations")))
    command.upgrade(cfg, "head")
    return True


@pytest_asyncio.fixture()
async def api_client(apply_migrations) -> AsyncIterator[AsyncClient]:
    from crm.app import main
    from crm.app import config as app_config

    importlib.reload(main)
    app = main.create_app()
    async with AsyncClient(app=app, base_url="http://testserver") as client:
        yield client


@pytest_asyncio.fixture()
async def db_session(apply_migrations) -> AsyncIterator[AsyncSession]:
    from crm.infrastructure.db import AsyncSessionFactory

    async with AsyncSessionFactory() as session:
        yield session
