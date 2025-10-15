from __future__ import annotations

import pytest
from pydantic import ValidationError

from backup.config import Settings


def _base_settings_kwargs() -> dict[str, object]:
    return {
        "database_url": "postgresql://user:pass@localhost:5432/db",
        "rabbitmq_url": "amqp://guest:guest@localhost:5672/",
        "postgres_backup_dsn": "postgresql://user:pass@localhost:5432/target",
        "consul_http_addr": "http://localhost:8500",
        "rabbitmq_management_url": "http://localhost:15672",
        "rabbitmq_admin_user": "guest",
        "rabbitmq_admin_password": "guest",
    }


def test_s3_endpoint_whitespace_becomes_none() -> None:
    settings = Settings(**_base_settings_kwargs(), s3_endpoint_url="   ")

    assert settings.s3_endpoint_url is None


def test_s3_endpoint_invalid_scheme_raises_error() -> None:
    with pytest.raises(ValidationError) as exc:
        Settings(**_base_settings_kwargs(), s3_endpoint_url="ftp://storage.local")

    assert "http://" in str(exc.value)


def test_s3_endpoint_trailing_spaces_trimmed() -> None:
    settings = Settings(
        **_base_settings_kwargs(),
        s3_endpoint_url=" https://storage.local/api "
    )

    assert settings.s3_endpoint_url == "https://storage.local/api"
