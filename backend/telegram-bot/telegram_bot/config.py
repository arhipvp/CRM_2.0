from __future__ import annotations

from functools import lru_cache
from typing import Literal
from uuid import UUID

from pydantic import AnyUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки Telegram-бота."""

    model_config = SettingsConfigDict(env_prefix="TELEGRAM_BOT_", env_file=".env", extra="ignore")

    bot_token: str = Field(..., description="Токен Telegram Bot API")
    bot_api_base: AnyUrl | None = Field(
        default=None,
        description="Базовый URL Bot API (используется для mock-сервера в локальной среде)",
    )
    webhook_secret: str = Field(..., description="Секрет подписи webhook-ов Telegram")
    webhook_path: str = Field(
        default="/webhook",
        description="Относительный путь FastAPI-эндпоинта для приема обновлений",
    )

    redis_url: AnyUrl = Field(..., description="Подключение к Redis для FSM и rate limiting")

    rabbitmq_url: AnyUrl = Field(..., description="AMQP-подключение к RabbitMQ")
    rabbitmq_exchange_crm: str = Field("crm.domain", description="Exchange CRM для публикации событий")
    rabbitmq_exchange_tasks: str = Field("tasks.events", description="Exchange Tasks для публикации событий")
    rabbitmq_exchange_notifications: str = Field(
        "notifications.events", description="Exchange Notifications для подписки на уведомления"
    )
    rabbitmq_queue_notifications: str = Field(
        "telegram.bot.notifications", description="Имя очереди для событий уведомлений"
    )
    rabbitmq_queue_crm: str = Field(
        "telegram.bot.crm", description="Имя очереди для подписки на CRM-события"
    )
    event_source: str = Field("crm.telegram-bot", description="Значение CloudEvents source для публикуемых событий")

    auth_base_url: AnyUrl = Field(..., description="Базовый URL Auth API")
    auth_service_token: str = Field(..., description="Сервисный токен для обращения к Auth")

    crm_base_url: AnyUrl = Field(..., description="Базовый URL CRM API")
    crm_service_token: str = Field(..., description="Сервисный токен CRM/Deals")
    default_tenant_id: UUID | None = Field(
        default=None,
        description="Тенант по умолчанию. Если не задан, ожидается tenant_id в ответе Auth",
    )

    notifications_base_url: AnyUrl = Field(..., description="Базовый URL Notifications API")
    notifications_service_token: str = Field(..., description="Сервисный токен для Notifications")

    healthcheck_token: str = Field(..., description="Токен проверки здоровья, используемый Gateway/BFF")

    environment: Literal["dev", "stage", "prod"] = Field(
        default="dev", description="Текущее окружение (используется в метриках и логировании)"
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
