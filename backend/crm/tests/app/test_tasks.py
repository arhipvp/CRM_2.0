from __future__ import annotations

import importlib
import inspect
import sys
from types import ModuleType, SimpleNamespace
from uuid import UUID, uuid4

import pytest
from unittest.mock import AsyncMock, Mock

config_module = ModuleType("crm.app.config")


class DummySettings:
    def __init__(self) -> None:
        self.app_name = "CRM Deals"
        self.api_prefix = "/api"
        self.service_host = "0.0.0.0"
        self.service_port = 8080
        self.database_url = "postgresql+asyncpg://user:pass@localhost:5432/db"
        self.redis_url = "redis://localhost:6379/0"
        self.rabbitmq_url = "amqp://guest:guest@localhost:5672/"
        self.resolved_celery_broker = self.rabbitmq_url
        self.resolved_celery_backend = self.redis_url
        self.celery_default_queue = "crm.sync"
        self.celery_task_routes = {}
        self.celery_retry_delay_seconds = 0

    def model_copy(self, *, update: dict | None = None, **_: object) -> "DummySettings":
        return self


config_module.Settings = DummySettings
config_module.settings = DummySettings()


def get_settings() -> DummySettings:  # noqa: D401 - простой алиас
    """Return cached dummy settings."""

    return config_module.settings


config_module.get_settings = get_settings
sys.modules["crm.app.config"] = config_module
app_module = importlib.import_module("crm.app")
setattr(app_module, "config", config_module)

from crm.app import tasks


@pytest.mark.asyncio()
async def test_update_deal_status_uses_repository(monkeypatch: pytest.MonkeyPatch) -> None:
    session = object()

    class DummySessionCM:
        async def __aenter__(self) -> object:
            return session

        async def __aexit__(self, exc_type, exc, tb) -> bool:
            return False

    monkeypatch.setattr(tasks, "AsyncSessionFactory", lambda: DummySessionCM())

    repo = SimpleNamespace(update=AsyncMock())
    captured_session: object | None = None

    def repo_factory(received_session: object) -> SimpleNamespace:
        nonlocal captured_session
        captured_session = received_session
        return repo

    monkeypatch.setattr(tasks, "DealRepository", repo_factory)

    tenant_id = uuid4()
    deal_id = uuid4()
    status = "won"

    await tasks._update_deal_status(tenant_id, deal_id, status)

    assert captured_session is session
    repo.update.assert_awaited_once_with(tenant_id, deal_id, {"status": status})


@pytest.mark.asyncio()
async def test_refresh_policy_status_uses_repository(monkeypatch: pytest.MonkeyPatch) -> None:
    session = object()

    class DummySessionCM:
        async def __aenter__(self) -> object:
            return session

        async def __aexit__(self, exc_type, exc, tb) -> bool:
            return False

    monkeypatch.setattr(tasks, "AsyncSessionFactory", lambda: DummySessionCM())

    repo = SimpleNamespace(update=AsyncMock())
    captured_session: object | None = None

    def repo_factory(received_session: object) -> SimpleNamespace:
        nonlocal captured_session
        captured_session = received_session
        return repo

    monkeypatch.setattr(tasks, "PolicyRepository", repo_factory)

    tenant_id = uuid4()
    policy_id = uuid4()
    status = "active"

    await tasks._refresh_policy_status(tenant_id, policy_id, status)

    assert captured_session is session
    repo.update.assert_awaited_once_with(tenant_id, policy_id, {"status": status})


def test_sync_deal_status_converts_identifiers_to_uuid(monkeypatch: pytest.MonkeyPatch) -> None:
    run_mock = Mock()
    monkeypatch.setattr(tasks.asyncio, "run", run_mock)

    update_mock = AsyncMock()
    monkeypatch.setattr(tasks, "_update_deal_status", update_mock)

    tenant_id = uuid4()
    deal_id = uuid4()
    status = "won"

    tasks.sync_deal_status(str(tenant_id), str(deal_id), status)

    update_mock.assert_called_once()
    called_tenant, called_deal, called_status = update_mock.call_args.args
    assert isinstance(called_tenant, UUID)
    assert isinstance(called_deal, UUID)
    assert called_tenant == tenant_id
    assert called_deal == deal_id
    assert called_status == status

    run_mock.assert_called_once()
    coroutine_arg = run_mock.call_args.args[0]
    assert inspect.iscoroutine(coroutine_arg)
    frame_locals = coroutine_arg.cr_frame.f_locals
    assert isinstance(frame_locals["args"][0], UUID)
    assert isinstance(frame_locals["args"][1], UUID)
    coroutine_arg.close()


def test_refresh_policy_state_converts_identifiers_to_uuid(monkeypatch: pytest.MonkeyPatch) -> None:
    run_mock = Mock()
    monkeypatch.setattr(tasks.asyncio, "run", run_mock)

    refresh_mock = AsyncMock()
    monkeypatch.setattr(tasks, "_refresh_policy_status", refresh_mock)

    tenant_id = uuid4()
    policy_id = uuid4()
    status = "active"

    tasks.refresh_policy_state(str(tenant_id), str(policy_id), status)

    refresh_mock.assert_called_once()
    called_tenant, called_policy, called_status = refresh_mock.call_args.args
    assert isinstance(called_tenant, UUID)
    assert isinstance(called_policy, UUID)
    assert called_tenant == tenant_id
    assert called_policy == policy_id
    assert called_status == status

    run_mock.assert_called_once()
    coroutine_arg = run_mock.call_args.args[0]
    assert inspect.iscoroutine(coroutine_arg)
    frame_locals = coroutine_arg.cr_frame.f_locals
    assert isinstance(frame_locals["args"][0], UUID)
    assert isinstance(frame_locals["args"][1], UUID)
    coroutine_arg.close()
