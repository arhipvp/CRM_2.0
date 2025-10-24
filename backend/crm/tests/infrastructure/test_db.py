import importlib
import sys
from collections.abc import Iterator
from types import ModuleType, SimpleNamespace

import pytest
from sqlalchemy.engine import make_url

fake_config = ModuleType("crm.app.config")
fake_config.settings = SimpleNamespace(
    database_url="postgresql+asyncpg://user@localhost:5432/dbname",
    redis_url="redis://localhost:6379/0",
    rabbitmq_url="amqp://guest:guest@localhost:5672/",
)

@pytest.fixture(autouse=True, scope="module")
def _override_config_module() -> Iterator[None]:
    original_module = sys.modules.get("crm.app.config")
    sys.modules["crm.app.config"] = fake_config
    try:
        yield
    finally:
        if original_module is not None:
            sys.modules["crm.app.config"] = original_module
        else:
            sys.modules.pop("crm.app.config", None)

from crm.infrastructure import db


@pytest.mark.parametrize(
    "raw_url, expected_url",
    [
        (
            "postgresql+asyncpg://user@localhost:5432/dbname",
            "postgresql+asyncpg://user@localhost:5432/dbname",
        ),
        (
            "postgresql://user@localhost:5432/dbname",
            "postgresql+asyncpg://user@localhost:5432/dbname",
        ),
    ],
)
def test_build_async_url_supported_drivers(raw_url: str, expected_url: str) -> None:
    url, connect_args = db._build_async_url(raw_url)

    assert url == make_url(expected_url)
    assert connect_args == {}


def test_build_async_url_unsupported_driver() -> None:
    with pytest.raises(ValueError):
        db._build_async_url("mysql://user@localhost:3306/dbname")


def test_build_async_url_extracts_options_search_path() -> None:
    url, connect_args = db._build_async_url(
        "postgresql://user@localhost:5432/dbname?options=-csearch_path%3Dcrm%20-cstatement_timeout%3D5000"
    )

    assert url == make_url(
        "postgresql+asyncpg://user@localhost:5432/dbname?options=-cstatement_timeout=5000"
    )
    assert connect_args == {"server_settings": {"search_path": "crm"}}


def test_build_async_url_extracts_split_options_search_path() -> None:
    url, connect_args = db._build_async_url(
        "postgresql://user@localhost:5432/dbname?options=-c%20search_path%3Dcrm"
    )

    assert url == make_url("postgresql+asyncpg://user@localhost:5432/dbname")
    assert connect_args == {"server_settings": {"search_path": "crm"}}


def test_create_async_engine_receives_search_path(monkeypatch: pytest.MonkeyPatch) -> None:
    original_settings = fake_config.settings
    fake_config.settings = SimpleNamespace(
        database_url="postgresql://user@localhost:5432/crm?search_path=crm",
        redis_url=original_settings.redis_url,
        rabbitmq_url=original_settings.rabbitmq_url,
    )

    captured: dict[str, object] = {}

    def fake_create_async_engine(url, **kwargs):  # noqa: ANN001
        captured["url"] = url
        captured["kwargs"] = kwargs

        class DummyEngine:  # noqa: D401
            """Stand-in for SQLAlchemy AsyncEngine."""

        return DummyEngine()

    monkeypatch.setattr("sqlalchemy.ext.asyncio.create_async_engine", fake_create_async_engine)

    try:
        importlib.reload(db)

        assert captured["url"] == make_url("postgresql+asyncpg://user@localhost:5432/crm")
        assert captured["kwargs"] == {
            "echo": False,
            "future": True,
            "pool_pre_ping": True,
            "connect_args": {"server_settings": {"search_path": "crm"}},
        }
    finally:
        fake_config.settings = original_settings
        monkeypatch.undo()
        importlib.reload(db)
