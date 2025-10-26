from __future__ import annotations

import importlib

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_deals_endpoint_returns_503_if_migrations_missing(monkeypatch):
    from crm.app import main as app_main

    importlib.reload(app_main)

    async def failing_check() -> tuple[bool, str | None]:
        return False, "CRM сервис недоступен: нужны миграции"

    monkeypatch.setattr(app_main, "_check_database_revision", failing_check)

    app = app_main.create_app()

    async with app.router.lifespan_context(app):
        async with AsyncClient(app=app, base_url="http://testserver") as client:
            response = await client.get("/api/v1/deals")

    assert response.status_code == 503
    assert "миграц" in response.json()["detail"].lower()
