from __future__ import annotations

import importlib
import sys
from types import ModuleType
from uuid import uuid4

from datetime import datetime, timedelta
import jwt

import pytest
from fastapi import HTTPException

if "crm.app.config" not in sys.modules:
    config_module = ModuleType("crm.app.config")

    class DummySettings:
        def __init__(
            self,
            default_tenant_id: str | None = None,
        ) -> None:
            self.app_name = "CRM Deals"
            self.api_prefix = "/api"
            self.service_host = "0.0.0.0"
            self.service_port = 8080
            self.database_url = "postgresql+asyncpg://user:pass@localhost:5432/db"
            self.redis_url = "redis://localhost:6379/0"
            self.rabbitmq_url = "amqp://guest:guest@localhost:5672/"
            self.events_exchange = "crm.events"
            self.default_tenant_id = default_tenant_id
            self.permissions_queue_name = "permissions:sync"
            self.permissions_queue_prefix = "bull"
            self.permissions_job_name = "permissions.sync"
            self.permissions_redis_url = None
            self.celery_retry_delay_seconds = 60
            self.jwt_access_secret = "test-secret"
            self.jwt_issuer = "http://localhost"
            self.jwt_audience = "crm-clients"

        def model_copy(self, *, update: dict | None = None, **_: object) -> DummySettings:
            if not update:
                return self
            return DummySettings(
                default_tenant_id=update.get("default_tenant_id", self.default_tenant_id),
            )

        @property
        def resolved_permissions_redis(self) -> str:
            return str(self.permissions_redis_url or self.redis_url)

    config_module.Settings = DummySettings
    config_module.settings = DummySettings()

    def get_settings() -> DummySettings:  # noqa: D401 - простой алиас
        """Return cached dummy settings."""

        return config_module.settings

    config_module.get_settings = get_settings
    sys.modules["crm.app.config"] = config_module
    app_module = importlib.import_module("crm.app")
    setattr(app_module, "config", config_module)

from crm.app.config import settings
from crm.app.dependencies import get_tenant_id


@pytest.mark.asyncio()
async def test_get_tenant_id_returns_uuid_for_valid_header() -> None:
    tenant_id = uuid4()

    result = await get_tenant_id(str(tenant_id))

    assert result == tenant_id


@pytest.mark.asyncio()
async def test_get_tenant_id_raises_for_invalid_uuid() -> None:
    with pytest.raises(HTTPException) as excinfo:
        await get_tenant_id("not-a-uuid")

    assert excinfo.value.status_code == 400
    assert excinfo.value.detail == "Invalid X-Tenant-ID header"


@pytest.mark.asyncio()
async def test_get_tenant_id_uses_default_when_header_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    default_tenant = uuid4()
    monkeypatch.setattr(settings, "default_tenant_id", str(default_tenant))

    result = await get_tenant_id()

    assert result == default_tenant


@pytest.mark.asyncio()
async def test_get_tenant_id_requires_scope_when_default_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    original_default = settings.default_tenant_id
    monkeypatch.setattr(settings, "default_tenant_id", None, raising=False)

    with pytest.raises(HTTPException) as excinfo:
        await get_tenant_id()

    assert excinfo.value.status_code == 400
    assert excinfo.value.detail == "Tenant scope is required"

    monkeypatch.setattr(settings, "default_tenant_id", original_default, raising=False)


@pytest.mark.asyncio()
async def test_get_tenant_id_rejects_invalid_default(monkeypatch: pytest.MonkeyPatch) -> None:
    original_default = settings.default_tenant_id
    monkeypatch.setattr(settings, "default_tenant_id", "not-a-uuid", raising=False)

    with pytest.raises(HTTPException) as excinfo:
        await get_tenant_id()

    assert excinfo.value.status_code == 500
    assert excinfo.value.detail == "invalid_default_tenant_id"

    monkeypatch.setattr(settings, "default_tenant_id", original_default, raising=False)


@pytest.mark.asyncio()
async def test_get_current_user_requires_token():
    from crm.app.dependencies import get_current_user

    with pytest.raises(HTTPException) as excinfo:
        await get_current_user()

    assert excinfo.value.status_code == 401


@pytest.mark.asyncio()
async def test_get_current_user_accepts_authorization_header():
    from crm.app.dependencies import get_current_user

    token_payload = {
        "sub": str(uuid4()),
        "email": "agent@example.com",
        "roles": ["agent"],
        "aud": settings.jwt_audience,
        "iss": settings.jwt_issuer,
        "exp": datetime.utcnow() + timedelta(minutes=5),
    }
    token = jwt.encode(token_payload, settings.jwt_access_secret, algorithm="HS256")

    user = await get_current_user(f"Bearer {token}")

    assert user.email == "agent@example.com"
    assert "agent" in user.roles


@pytest.mark.asyncio()
async def test_get_current_user_accepts_cookie():
    from crm.app.dependencies import get_current_user

    token_payload = {
        "sub": str(uuid4()),
        "email": "cookie@example.com",
        "roles": ["manager"],
        "aud": settings.jwt_audience,
        "iss": settings.jwt_issuer,
        "exp": datetime.utcnow() + timedelta(minutes=5),
    }
    token = jwt.encode(token_payload, settings.jwt_access_secret, algorithm="HS256")

    user = await get_current_user(None, token)

    assert user.email == "cookie@example.com"
    assert "manager" in user.roles


@pytest.mark.asyncio()
async def test_get_current_user_falls_back_to_cookie_for_invalid_header():
    from crm.app.dependencies import get_current_user

    token_payload = {
        "sub": str(uuid4()),
        "email": "cookie@example.com",
        "roles": ["manager"],
        "aud": settings.jwt_audience,
        "iss": settings.jwt_issuer,
        "exp": datetime.utcnow() + timedelta(minutes=5),
    }
    token = jwt.encode(token_payload, settings.jwt_access_secret, algorithm="HS256")

    user = await get_current_user("Basic invalid", token)

    assert user.email == "cookie@example.com"
    assert "manager" in user.roles


@pytest.mark.asyncio()
async def test_get_current_user_rejects_invalid_token():
    from crm.app.dependencies import get_current_user

    with pytest.raises(HTTPException) as excinfo:
        await get_current_user("Bearer invalid")

    assert excinfo.value.status_code == 401
