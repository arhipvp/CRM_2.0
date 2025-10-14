from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from types import ModuleType
from typing import Any
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import APIRouter, FastAPI


class DummySettings:
    def __init__(self) -> None:
        self.enable_payments_consumer = False
        self.app_name = "Test CRM"
        self.api_prefix = "/api"
        self.service_host = "127.0.0.1"
        self.service_port = 8000


def _install_test_modules() -> None:
    if "crm.app.config" not in sys.modules:
        config_module = ModuleType("crm.app.config")
        config_module.Settings = DummySettings
        config_module.settings = DummySettings()

        def get_settings() -> DummySettings:
            return config_module.settings

        config_module.get_settings = get_settings
        sys.modules["crm.app.config"] = config_module

    if "crm.app.dependencies" not in sys.modules:
        dependencies_module = ModuleType("crm.app.dependencies")

        def get_session_factory() -> object:  # noqa: D401 - test stub
            raise NotImplementedError("Session factory should be patched in tests")

        dependencies_module.get_session_factory = get_session_factory
        sys.modules["crm.app.dependencies"] = dependencies_module

    if "crm.api.router" not in sys.modules:
        router_module = ModuleType("crm.api.router")

        def get_api_router() -> APIRouter:
            return APIRouter()

        router_module.get_api_router = get_api_router
        sys.modules["crm.api.router"] = router_module

    if "crm.app.events" not in sys.modules:
        events_module = ModuleType("crm.app.events")

        class PaymentsEventsSubscriber:  # pragma: no cover - placeholder
            async def start(self) -> None:
                raise NotImplementedError

            async def stop(self) -> None:
                raise NotImplementedError

        events_module.PaymentsEventsSubscriber = PaymentsEventsSubscriber
        sys.modules["crm.app.events"] = events_module


_install_test_modules()

from crm.app.main import lifespan, settings  # noqa: E402


@asynccontextmanager
async def run_lifespan() -> dict[str, Any]:
    async with lifespan(FastAPI()) as context:
        yield context


@pytest.mark.asyncio()
async def test_lifespan_starts_payments_subscriber(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "enable_payments_consumer", True)

    fake_session_factory = object()
    session_factory_mock = Mock(return_value=fake_session_factory)
    monkeypatch.setattr("crm.app.main.get_session_factory", session_factory_mock)

    created_instances: list[Any] = []

    class DummySubscriber:
        def __init__(self, settings_arg: Any, session_factory_arg: Any) -> None:
            self.settings = settings_arg
            self.session_factory = session_factory_arg
            self.start = AsyncMock()
            self.stop = AsyncMock()
            created_instances.append(self)

    monkeypatch.setattr("crm.app.main.PaymentsEventsSubscriber", DummySubscriber)

    async with run_lifespan() as context:
        subscriber = context["payments_subscriber"]
        assert subscriber is created_instances[0]
        created_instances[0].start.assert_awaited_once()

    created_instances[0].stop.assert_awaited_once()
    assert created_instances[0].session_factory is fake_session_factory
    session_factory_mock.assert_called_once_with()


@pytest.mark.asyncio()
async def test_lifespan_handles_start_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "enable_payments_consumer", True)

    session_factory_mock = Mock()
    monkeypatch.setattr("crm.app.main.get_session_factory", session_factory_mock)

    created_instances: list[Any] = []

    class FailingSubscriber:
        def __init__(self, *_: Any, **__: Any) -> None:
            self.start = AsyncMock(side_effect=RuntimeError("boom"))
            self.stop = AsyncMock()
            created_instances.append(self)

    monkeypatch.setattr("crm.app.main.PaymentsEventsSubscriber", FailingSubscriber)

    async with run_lifespan() as context:
        assert context["payments_subscriber"] is None
        created_instances[0].start.assert_awaited_once()

    created_instances[0].stop.assert_not_called()
    session_factory_mock.assert_called_once_with()


@pytest.mark.asyncio()
async def test_lifespan_disabled_does_not_create_subscriber(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "enable_payments_consumer", False)

    session_factory_mock = Mock()
    monkeypatch.setattr("crm.app.main.get_session_factory", session_factory_mock)

    subscriber_factory = Mock(side_effect=AssertionError("subscriber should not be created"))
    monkeypatch.setattr("crm.app.main.PaymentsEventsSubscriber", subscriber_factory)

    async with run_lifespan() as context:
        assert context["payments_subscriber"] is None

    subscriber_factory.assert_not_called()
    session_factory_mock.assert_not_called()
