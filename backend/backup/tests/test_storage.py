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

    settings_with_whitespace_endpoint = _build_settings(s3_endpoint_url="   ")
    assert settings_with_whitespace_endpoint.s3_endpoint_url is None

    storage = S3Storage(settings_with_whitespace_endpoint)

    assert captured_kwargs.get("endpoint_url") is None
    assert isinstance(storage._client, DummyClient)

    payload = _settings_payload()
    payload.pop("s3_endpoint_url", None)
    monkeypatch.setenv("BACKUP_S3_ENDPOINT_URL", "   ")
    try:
        settings_from_env = Settings(**payload)
    finally:
        monkeypatch.delenv("BACKUP_S3_ENDPOINT_URL", raising=False)

    assert settings_from_env.s3_endpoint_url is None

    storage = S3Storage(settings_from_env)

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


def test_build_storage_uses_default_region_when_env_empty(monkeypatch) -> None:
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

    payload = _settings_payload(s3_endpoint_url="http://localhost:9000")
    monkeypatch.setenv("BACKUP_S3_REGION_NAME", "   ")

    settings = Settings(**payload)

    storage = build_storage(settings)

    assert isinstance(storage, S3Storage)
    assert captured_kwargs.get("region_name") == "us-east-1"
    assert settings.s3_region_name == "us-east-1"


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


def test_build_storage_handles_docker_compose_defaults(monkeypatch) -> None:
    def _fail_session() -> None:
        pytest.fail("S3Session должен быть инициализирован только при наличии параметров")

    monkeypatch.setattr(boto3.session, "Session", _fail_session)

    env_values = {
        "BACKUP_DATABASE_URL": "postgresql://backup:backup@postgres:5432/crm?options=-csearch_path%3Dbackup",
        "BACKUP_RABBITMQ_URL": "amqp://crm:crm@rabbitmq:5672/crm",
        "BACKUP_POSTGRES_BACKUP_DSN": "postgresql://postgres:postgres@postgres:5432/crm",
        "BACKUP_CONSUL_HTTP_ADDR": "http://consul:8500",
        "BACKUP_RABBITMQ_MANAGEMENT_URL": "http://rabbitmq:15672",
        "BACKUP_RABBITMQ_ADMIN_USER": "guest",
        "BACKUP_RABBITMQ_ADMIN_PASSWORD": "guest",
        "BACKUP_S3_ENDPOINT_URL": "",
        "BACKUP_S3_BUCKET": "",
        "BACKUP_S3_ACCESS_KEY": "",
        "BACKUP_S3_SECRET_KEY": "",
        "BACKUP_CONSUL_TOKEN": "",
        "BACKUP_REDIS_USERNAME": "",
        "BACKUP_REDIS_PASSWORD": "",
        "BACKUP_REDIS_DATA_DIR": "",
    }

    for key, value in env_values.items():
        monkeypatch.setenv(key, value)

    settings = Settings()

    assert settings.s3_bucket is None
    assert settings.s3_access_key is None
    assert settings.s3_secret_key is None
    assert settings.s3_endpoint_url is None
    assert settings.consul_token is None
    assert settings.redis_username is None
    assert settings.redis_password is None
    assert settings.redis_data_dir is None

    storage = build_storage(settings)

    assert isinstance(storage, DummyStorage)


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


def test_build_storage_returns_dummy_when_s3_creation_fails(monkeypatch, caplog) -> None:
    class DummySession:
        def client(self, service_name: str, **kwargs: object) -> object:  # noqa: ARG002
            raise ValueError("broken config")

    monkeypatch.setattr(boto3.session, "Session", lambda: DummySession())

    settings = _build_settings(s3_endpoint_url="http://localhost:9000")

    with caplog.at_level("WARNING"):
        storage = build_storage(settings)

    assert isinstance(storage, DummyStorage)
    assert any(
        "Не удалось инициализировать S3Storage" in message for message in caplog.messages
    )


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
