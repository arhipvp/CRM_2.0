import sys
from types import ModuleType, SimpleNamespace

import pytest
from sqlalchemy.engine import make_url

fake_config = ModuleType("crm.app.config")
fake_config.settings = SimpleNamespace(
    database_url="postgresql+asyncpg://user@localhost:5432/dbname",
    redis_url="redis://localhost:6379/0",
    rabbitmq_url="amqp://guest:guest@localhost:5672/",
)

sys.modules.setdefault("crm.app.config", fake_config)

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
    url = db._build_async_url(raw_url)

    assert url == make_url(expected_url)


def test_build_async_url_unsupported_driver() -> None:
    with pytest.raises(ValueError):
        db._build_async_url("mysql://user@localhost:3306/dbname")
