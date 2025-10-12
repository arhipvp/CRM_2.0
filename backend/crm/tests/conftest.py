from __future__ import annotations

import asyncio
import importlib
import os
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
from testcontainers.rabbitmq import RabbitMqContainer
from testcontainers.redis import RedisContainer

from crm.app import config as app_config


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
    os.environ["CRM_RABBITMQ_URL"] = rabbitmq.get_connection_url()
    os.environ["CRM_ENABLE_PAYMENTS_CONSUMER"] = "0"
    os.environ.setdefault("CRM_CELERY_BROKER_URL", os.environ["CRM_REDIS_URL"])
    os.environ.setdefault("CRM_CELERY_RESULT_BACKEND", os.environ["CRM_REDIS_URL"])
    os.environ.setdefault("CRM_DEFAULT_TENANT_ID", str(uuid4()))

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

    app_config.settings.enable_payments_consumer = False
    importlib.reload(main)
    app = main.create_app()
    async with AsyncClient(app=app, base_url="http://testserver") as client:
        yield client


@pytest_asyncio.fixture()
async def db_session(apply_migrations) -> AsyncIterator[AsyncSession]:
    from crm.infrastructure.db import AsyncSessionFactory

    async with AsyncSessionFactory() as session:
        yield session
