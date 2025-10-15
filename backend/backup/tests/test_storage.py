from __future__ import annotations

import boto3

from backup.config import Settings
from backup.storage import S3Storage


def _build_settings(**overrides: object) -> Settings:
    base = {
        "database_url": "postgresql://user:pass@localhost:5432/db",
        "s3_access_key": "access",
        "s3_secret_key": "secret",
        "s3_bucket": "bucket",
        "rabbitmq_url": "amqp://guest:guest@localhost/",
        "postgres_backup_dsn": "postgresql://user:pass@localhost:5432/db",
        "consul_http_addr": "http://localhost:8500",
        "rabbitmq_management_url": "http://localhost:15672",
        "rabbitmq_admin_user": "guest",
        "rabbitmq_admin_password": "guest",
    }
    base.update(overrides)
    return Settings(**base)


def test_s3_storage_uses_none_endpoint_when_not_provided(monkeypatch) -> None:
    captured_kwargs: dict[str, object] = {}

    class DummyClient:
        pass

    class DummySession:
        def client(self, service_name: str, **kwargs: object) -> DummyClient:
            captured_kwargs.clear()
            captured_kwargs.update(kwargs)
            assert service_name == "s3"
            return DummyClient()

    monkeypatch.setattr(boto3.session, "Session", lambda: DummySession())

    settings = _build_settings()
    storage = S3Storage(settings)

    assert captured_kwargs.get("endpoint_url") is None
    assert isinstance(storage._client, DummyClient)

    settings_with_empty_endpoint = _build_settings(s3_endpoint_url="")
    assert settings_with_empty_endpoint.s3_endpoint_url is None

    storage = S3Storage(settings_with_empty_endpoint)

    assert captured_kwargs.get("endpoint_url") is None
    assert isinstance(storage._client, DummyClient)
