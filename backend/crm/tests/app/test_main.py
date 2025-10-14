from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI

from crm.app import dependencies, main


@pytest.mark.asyncio()
async def test_lifespan_closes_permissions_queue(monkeypatch: pytest.MonkeyPatch) -> None:
    close_mock = AsyncMock()
    monkeypatch.setattr(dependencies, "close_permissions_queue", close_mock)

    async with main.lifespan(FastAPI()):
        pass

    close_mock.assert_awaited_once()


def test_create_app_uses_settings_name(monkeypatch: pytest.MonkeyPatch) -> None:
    class DummySettings:
        app_name = "Custom CRM"
        api_prefix = "/api"

    monkeypatch.setattr(main, "settings", DummySettings())
    app = main.create_app()
    assert app.title == "Custom CRM"
