from __future__ import annotations

import boto3
import pytest

from backup.config import Settings
from backup.storage import DummyStorage, S3Storage, build_storage


def _settings_payload(**overrides: object) -> dict[str, object]:
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
    return base


def _build_settings(**overrides: object) -> Settings:
    return Settings(**_settings_payload(**overrides))


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


def test_build_storage_returns_s3_when_all_params_present(monkeypatch) -> None:
    created_clients: list[object] = []

    class DummyClient:
        pass

    class DummySession:
        def client(self, service_name: str, **kwargs: object) -> DummyClient:
            created_clients.append(DummyClient())
            return created_clients[-1]

    monkeypatch.setattr(boto3.session, "Session", lambda: DummySession())

    settings = _build_settings(s3_endpoint_url="http://localhost:9000")

    storage = build_storage(settings)

    assert isinstance(storage, S3Storage)
    assert created_clients, "Ожидали создание клиента S3"


def test_settings_normalize_empty_s3_values_to_none() -> None:
    settings = Settings(
        **_settings_payload(s3_access_key="", s3_secret_key="  ", s3_bucket=""),
    )

    assert settings.s3_access_key is None
    assert settings.s3_secret_key is None
    assert settings.s3_bucket is None


def test_settings_use_none_when_s3_fields_absent() -> None:
    payload = _settings_payload()
    payload.pop("s3_access_key")
    payload.pop("s3_secret_key")
    payload.pop("s3_bucket")

    settings = Settings(**payload)

    assert settings.s3_access_key is None
    assert settings.s3_secret_key is None
    assert settings.s3_bucket is None


@pytest.mark.parametrize(
    "overrides",
    [
        {"s3_access_key": None},
        {"s3_secret_key": None},
        {"s3_bucket": None},
        {"s3_access_key": "", "s3_secret_key": "secret"},
        {"s3_secret_key": "", "s3_access_key": "access"},
        {"s3_bucket": ""},
    ],
)
def test_build_storage_returns_dummy_when_s3_params_missing(overrides: dict[str, object]) -> None:
    settings = _build_settings(**overrides)

    storage = build_storage(settings)

    assert isinstance(storage, DummyStorage)


@pytest.mark.asyncio
async def test_dummy_storage_saves_files_locally(tmp_path) -> None:
    settings = _build_settings(
        s3_endpoint_url=None,
        s3_access_key="",
        s3_secret_key="",
        s3_bucket="",
        artifacts_dir=tmp_path,
    )
    storage = DummyStorage(settings)

    source = tmp_path / "source.txt"
    source.write_text("payload")

    key = await storage.upload_file(source, suggested_name="artifact.txt")

    stored_path = tmp_path / key
    assert stored_path.exists()
    assert stored_path.read_text() == "payload"
