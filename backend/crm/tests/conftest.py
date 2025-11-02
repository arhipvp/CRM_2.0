from __future__ import annotations

import asyncio
import importlib
import os
import sys
from collections.abc import AsyncIterator, Iterator
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
import aio_pika
from alembic import command
from alembic.config import Config
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.ext.asyncio import AsyncSession
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer
from urllib.parse import quote

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


class _InMemoryBroker:
    def __init__(self) -> None:
        self.exchanges: dict[str, _FakeExchange] = {}
        self.queues: list[_FakeQueue] = []
        self.messages: list[tuple[str, str, bytes]] = []

    def get_exchange(self, name: str) -> "_FakeExchange":
        exchange = self.exchanges.get(name)
        if exchange is None:
            exchange = _FakeExchange(name, self)
            self.exchanges[name] = exchange
        return exchange

    def register_queue(self, queue: "_FakeQueue") -> None:
        self.queues.append(queue)


class _FakeConnection:
    def __init__(self, broker: _InMemoryBroker) -> None:
        self._broker = broker

    async def channel(self, publisher_confirms: bool = False) -> "_FakeChannel":  # noqa: FBT002
        return _FakeChannel(self._broker)

    async def close(self) -> None:
        return None


class _FakeChannel:
    def __init__(self, broker: _InMemoryBroker) -> None:
        self._broker = broker

    async def declare_exchange(self, name: str, _type, durable: bool = True) -> "_FakeExchange":  # noqa: FBT002
        return self._broker.get_exchange(name)

    async def declare_queue(self, exclusive: bool = False, auto_delete: bool = False) -> "_FakeQueue":  # noqa: FBT002
        queue = _FakeQueue(self._broker)
        self._broker.register_queue(queue)
        return queue

    async def close(self) -> None:
        return None


class _FakeExchange:
    def __init__(self, name: str, broker: _InMemoryBroker) -> None:
        self.name = name
        self._broker = broker
        self._bindings: list[tuple["_FakeQueue", str]] = []

    async def publish(self, message: aio_pika.Message, routing_key: str) -> None:
        self._broker.messages.append((self.name, routing_key, message.body))
        for queue, pattern in list(self._bindings):
            if _matches_topic(pattern, routing_key):
                await queue._enqueue(message, routing_key)

    def register_binding(self, queue: "_FakeQueue", routing_key: str) -> None:
        self._bindings.append((queue, routing_key))


class _FakeIncomingMessage:
    def __init__(self, body: bytes, routing_key: str, queue: "_FakeQueue") -> None:
        self.body = body
        self.routing_key = routing_key
        self._queue = queue
        self._acked = False

    async def ack(self) -> None:
        self._acked = True


class _FakeQueue:
    def __init__(self, broker: _InMemoryBroker) -> None:
        self._broker = broker
        self._bindings: list[tuple[_FakeExchange, str]] = []
        self._queue: asyncio.Queue[_FakeIncomingMessage] = asyncio.Queue()

    async def bind(self, exchange: _FakeExchange, routing_key: str) -> None:
        exchange.register_binding(self, routing_key)
        self._bindings.append((exchange, routing_key))

    async def get(self, timeout: float | None = None):
        if timeout is None:
            message = await self._queue.get()
        else:
            message = await asyncio.wait_for(self._queue.get(), timeout=timeout)
        return message

    async def _enqueue(self, message: aio_pika.Message, routing_key: str) -> None:
        incoming = _FakeIncomingMessage(message.body, routing_key, self)
        await self._queue.put(incoming)

    async def delete(self, *, if_unused: bool = False, if_empty: bool = False) -> None:  # noqa: FBT002
        return None


def _matches_topic(pattern: str, key: str) -> bool:
    pattern_parts = pattern.split('.')
    key_parts = key.split('.')

    def _match(pp: list[str], kp: list[str]) -> bool:
        if not pp:
            return not kp
        head, *rest = pp
        if head == '#':
            if _match(rest, kp):
                return True
            return bool(kp) and _match(pp, kp[1:])
        if head == '*':
            return bool(kp) and _match(rest, kp[1:])
        return bool(kp) and head == kp[0] and _match(rest, kp[1:])

    return _match(pattern_parts, key_parts)


_BROKER = _InMemoryBroker()


async def _connect_robust_stub(*args, **kwargs):
    return _FakeConnection(_BROKER)


aio_pika.connect_robust = _connect_robust_stub


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

    container = RabbitMqContainer("rabbitmq:3.11-management")
    container.start()
    try:
        yield container
    finally:
        container.stop()


@pytest.fixture(scope="session")
def configure_environment(postgres: PostgresContainer, redis: RedisContainer, rabbitmq: RabbitMqContainer):
    db_url = postgres.get_connection_url()
    os.environ["CRM_DATABASE_URL"] = db_url

    redis_host = redis.get_container_host_ip()
    redis_port = redis.get_exposed_port(redis.port)
    if redis.password:
        redis_url = f"redis://:{redis.password}@{redis_host}:{redis_port}/0"
    else:
        redis_url = f"redis://{redis_host}:{redis_port}/0"
    os.environ["CRM_REDIS_URL"] = redis_url
    os.environ["CRM_PERMISSIONS_REDIS_URL"] = redis_url

    rabbit_params = rabbitmq.get_connection_params()
    rabbit_host = rabbit_params.host
    rabbit_port = rabbit_params.port
    rabbit_user = getattr(rabbit_params.credentials, "username", "guest")
    rabbit_pass = getattr(rabbit_params.credentials, "password", "guest")
    virtual_host = rabbit_params.virtual_host or "/"
    if virtual_host == "/":
        rabbit_vhost = "/"
    else:
        rabbit_vhost = quote(virtual_host, safe="")
    os.environ["CRM_RABBITMQ_URL"] = f"amqp://{rabbit_user}:{rabbit_pass}@{rabbit_host}:{rabbit_port}/{rabbit_vhost}"
    os.environ.setdefault("CRM_CELERY_BROKER_URL", os.environ["CRM_REDIS_URL"])
    os.environ.setdefault("CRM_CELERY_RESULT_BACKEND", os.environ["CRM_REDIS_URL"])
    os.environ.setdefault("CRM_NOTIFICATIONS_TELEGRAM_ENABLED", "true")
    os.environ.setdefault("CRM_NOTIFICATIONS_TELEGRAM_MOCK", "true")
    os.environ.setdefault("CRM_NOTIFICATIONS_TELEGRAM_BOT_TOKEN", "mock-token")
    os.environ.setdefault("CRM_NOTIFICATIONS_TELEGRAM_DEFAULT_CHAT_ID", "123456")

    from crm.app import config as app_config

    app_config.get_settings.cache_clear()
    app_config.settings = app_config.get_settings()

    db_module = importlib.import_module("crm.infrastructure.db")
    importlib.reload(db_module)
    return app_config.settings


@pytest.fixture(scope="session")
def apply_migrations(configure_environment):
    async def _ensure_schemas() -> None:
        async_url = str(configure_environment.database_url)
        if async_url.startswith("postgresql://"):
            async_url = async_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif async_url.startswith("postgresql+psycopg2://"):
            async_url = async_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
        engine = create_async_engine(async_url)
        async with engine.begin() as connection:
            await connection.execute(text("CREATE SCHEMA IF NOT EXISTS crm"))
            await connection.execute(text("CREATE SCHEMA IF NOT EXISTS tasks"))
            await connection.execute(text("CREATE SCHEMA IF NOT EXISTS auth"))
            await connection.execute(text("CREATE SCHEMA IF NOT EXISTS documents"))
            await connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS auth.users (
                        id UUID PRIMARY KEY,
                        email TEXT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                    """
                )
            )
            await connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS documents.documents (
                        id UUID PRIMARY KEY,
                        name TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                    """
                )
            )
        await engine.dispose()

    asyncio.run(_ensure_schemas())

    cfg = Config(str(BASE_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BASE_DIR / "migrations"))
    command.upgrade(cfg, "head")
    return True


@pytest_asyncio.fixture()
async def api_client(apply_migrations) -> AsyncIterator[AsyncClient]:
    from crm.app import main
    from crm.app import config as app_config
    from crm.app.events import EventsPublisher

    importlib.reload(main)
    app = main.create_app()
    publisher = EventsPublisher(app_config.settings)
    await publisher.connect()
    app.state.events_publisher = publisher
    try:
        async with AsyncClient(app=app, base_url="http://testserver") as client:
            yield client
    finally:
        await publisher.close()



@pytest_asyncio.fixture()
async def db_session(apply_migrations) -> AsyncIterator[AsyncSession]:
    from crm.infrastructure.db import AsyncSessionFactory

    async with AsyncSessionFactory() as session:
        yield session


@pytest_asyncio.fixture()
async def document_id(db_session: AsyncSession) -> AsyncIterator[UUID]:
    document_id = uuid4()
    now = datetime.now(timezone.utc)

    await db_session.execute(
        text(
            """
            INSERT INTO documents.documents (id, name, status, created_at, updated_at)
            VALUES (:id, :name, :status, :created_at, :updated_at)
            """
        ),
        {
            "id": document_id,
            "name": "test-policy-document",
            "status": "pending_upload",
            "created_at": now,
            "updated_at": now,
        },
    )
    await db_session.commit()

    try:
        yield document_id
    finally:
        await db_session.execute(
            text("DELETE FROM documents.documents WHERE id = :id"),
            {"id": document_id},
        )
        await db_session.commit()
