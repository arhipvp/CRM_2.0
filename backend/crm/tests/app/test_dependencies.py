from __future__ import annotations

import importlib
import sys
from types import ModuleType
from uuid import uuid4

import pytest
from fastapi import HTTPException

if "crm.app.config" not in sys.modules:
    config_module = ModuleType("crm.app.config")

    class DummySettings:
        def __init__(
            self,
            payments_retry_limit: int = 3,
            default_tenant_id: str | None = None,
        ) -> None:
            self.payments_retry_limit = payments_retry_limit
            self.database_url = "postgresql+asyncpg://user:pass@localhost:5432/db"
            self.redis_url = "redis://localhost:6379/0"
            self.rabbitmq_url = "amqp://guest:guest@localhost:5672/"
            self.payments_queue = "crm.payments-sync"
            self.payments_exchange = "payments.events"
            self.payments_retry_exchange = "crm.payments-sync.retry"
            self.payments_retry_queue = "crm.payments-sync.retry"
            self.payments_dlx_exchange = "crm.payments-sync.dlx"
            self.payments_dlx_queue = "crm.payments-sync.dlx"
            self.payments_retry_delay_ms = 0
            self.events_exchange = "crm.events"
            self.default_tenant_id = default_tenant_id

        def model_copy(self, *, update: dict | None = None, **_: object) -> DummySettings:
            if not update:
                return self
            return DummySettings(
                payments_retry_limit=update.get("payments_retry_limit", self.payments_retry_limit),
                default_tenant_id=update.get("default_tenant_id", self.default_tenant_id),
            )

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
