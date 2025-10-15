from __future__ import annotations

import hashlib
import hmac
from unittest.mock import AsyncMock

import httpx
import pytest
from fakeredis.aioredis import FakeRedis

from telegram_bot.app import create_app
from telegram_bot.config import Settings


@pytest.fixture()
def test_settings() -> Settings:
    return Settings(  # type: ignore[call-arg]
        bot_token="123456:TESTTOKEN",
        webhook_secret="secret",
        redis_url="redis://localhost/0",
        rabbitmq_url="amqp://guest:guest@localhost/",
        auth_base_url="http://auth",
        auth_service_token="svc-auth",
        crm_base_url="http://crm",
        crm_service_token="svc-crm",
        notifications_base_url="http://notifications",
        notifications_service_token="svc-notifications",
        healthcheck_token="health-token",
    )


@pytest.mark.asyncio
async def test_webhook_signature_and_dispatch(monkeypatch: pytest.MonkeyPatch, test_settings: Settings) -> None:
    fake_redis = FakeRedis(decode_responses=True)
    monkeypatch.setattr("telegram_bot.app.Redis.from_url", classmethod(lambda cls, url, **kwargs: fake_redis))
    monkeypatch.setattr("telegram_bot.app.NotificationsConsumer.start", AsyncMock())
    monkeypatch.setattr("telegram_bot.app.NotificationsConsumer.stop", AsyncMock())

    app = create_app(test_settings)
    dispatcher = app.state.application.dispatcher
    dispatcher.feed_raw_update = AsyncMock()  # type: ignore[assignment]

    body = b"{\"update_id\":1}"
    signature = hmac.new(test_settings.webhook_secret.encode(), body, hashlib.sha256).hexdigest()

    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            test_settings.webhook_path,
            content=body,
            headers={"X-Telegram-Signature": signature},
        )
    assert response.status_code == 204
    dispatcher.feed_raw_update.assert_awaited_once()  # type: ignore[attr-defined]

    await fake_redis.close()


@pytest.mark.asyncio
async def test_webhook_rejects_invalid_signature(monkeypatch: pytest.MonkeyPatch, test_settings: Settings) -> None:
    fake_redis = FakeRedis(decode_responses=True)
    monkeypatch.setattr("telegram_bot.app.Redis.from_url", classmethod(lambda cls, url, **kwargs: fake_redis))
    monkeypatch.setattr("telegram_bot.app.NotificationsConsumer.start", AsyncMock())
    monkeypatch.setattr("telegram_bot.app.NotificationsConsumer.stop", AsyncMock())

    app = create_app(test_settings)

    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(test_settings.webhook_path, content=b"{}", headers={"X-Telegram-Signature": "invalid"})
    assert response.status_code == 401

    await fake_redis.close()
