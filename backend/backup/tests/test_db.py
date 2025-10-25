from __future__ import annotations

from urllib.parse import parse_qsl, urlsplit

import pytest

from backup.config import Settings
from backup.db import BackupRepository, RepositoryFactory


def _build_settings(database_url: str) -> Settings:
    return Settings(
        database_url=database_url,
        rabbitmq_url="amqp://guest:guest@localhost/",
        postgres_backup_dsn="postgresql://user:pass@localhost:5432/db",
        consul_http_addr="http://localhost:8500",
        rabbitmq_management_url="http://localhost:15672",
        rabbitmq_admin_user="guest",
        rabbitmq_admin_password="guest",
    )


class DummyPool:
    def __init__(self, dsn: str, *, open: bool) -> None:
        self.dsn = dsn
        self.open_flag = open
        self.open_calls = 0
        self.close_calls = 0

    async def open(self) -> None:
        self.open_calls += 1

    async def close(self) -> None:
        self.close_calls += 1


@pytest.mark.asyncio
async def test_repository_factory_converts_search_path_to_options(monkeypatch: pytest.MonkeyPatch) -> None:
    captured_pool: dict[str, DummyPool] = {}

    def _pool_factory(dsn: str, *, open: bool) -> DummyPool:
        pool = DummyPool(dsn, open=open)
        captured_pool["pool"] = pool
        return pool

    async def _ensure_schema_stub(self: BackupRepository) -> None:  # pragma: no cover - патч для теста
        return None

    monkeypatch.setattr("backup.db.AsyncConnectionPool", _pool_factory)
    monkeypatch.setattr(BackupRepository, "ensure_schema", _ensure_schema_stub)

    settings = _build_settings(
        "postgresql://backup:backup@localhost:5432/crm?search_path=backup&sslmode=prefer"
    )
    factory = RepositoryFactory(settings)

    repository = await factory.create()

    assert isinstance(repository, BackupRepository)
    pool = captured_pool["pool"]
    assert pool.open_calls == 1

    parts = urlsplit(pool.dsn)
    query = dict(parse_qsl(parts.query))

    assert "search_path" not in query
    assert query.get("options") == "-csearch_path=backup"
    assert query.get("sslmode") == "prefer"


@pytest.mark.asyncio
async def test_repository_factory_respects_options_search_path(monkeypatch: pytest.MonkeyPatch) -> None:
    captured_pool: dict[str, DummyPool] = {}

    def _pool_factory(dsn: str, *, open: bool) -> DummyPool:
        pool = DummyPool(dsn, open=open)
        captured_pool["pool"] = pool
        return pool

    async def _ensure_schema_stub(self: BackupRepository) -> None:  # pragma: no cover - патч для теста
        return None

    monkeypatch.setattr("backup.db.AsyncConnectionPool", _pool_factory)
    monkeypatch.setattr(BackupRepository, "ensure_schema", _ensure_schema_stub)

    settings = _build_settings(
        "postgresql://backup:backup@localhost:5432/crm?options=-csearch_path%3Dbackup&sslmode=prefer"
    )
    factory = RepositoryFactory(settings)

    repository = await factory.create()

    assert isinstance(repository, BackupRepository)
    pool = captured_pool["pool"]
    assert pool.open_calls == 1

    parts = urlsplit(pool.dsn)
    query = dict(parse_qsl(parts.query))

    assert query.get("options") == "-csearch_path=backup"
    assert query.get("sslmode") == "prefer"
