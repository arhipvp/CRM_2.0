from functools import lru_cache
from typing import Optional

from pydantic import AnyUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="CRM_",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = Field(default="CRM Deals Service")
    api_prefix: str = Field(default="/api/v1")

    service_host: str = Field(default="0.0.0.0")
    service_port: int = Field(default=8082)

    database_url: AnyUrl = Field(
        default="postgresql+asyncpg://localhost:5432/crm",
    )
    redis_url: AnyUrl = Field(default="redis://localhost:6379/0")
    rabbitmq_url: AnyUrl = Field(default="amqp://localhost:5672/")

    tasks_events_exchange: str = Field(default="tasks.events")
    tasks_events_source: str = Field(default="crm.tasks")
    tasks_events_routing_keys: dict[str, str] = Field(
        default_factory=lambda: {
            "task_created": "task.created",
            "task_status_changed": "task.status.changed",
            "task_reminder": "task.reminder",
        }
    )

    tasks_reminders_queue_key: str = Field(default="tasks:reminders")
    tasks_reminders_poll_interval_ms: int = Field(default=5000)
    tasks_scheduling_batch_size: int = Field(default=100)
    tasks_delayed_queue_key: str = Field(default="tasks:delayed")

    permissions_queue_name: str = Field(default="permissions:sync")
    permissions_queue_prefix: str = Field(default="bull")
    permissions_job_name: str = Field(default="permissions.sync")
    permissions_redis_url: Optional[AnyUrl] = Field(default=None)

    jwt_access_secret: str = Field(default="dev-secret-change-in-production")
    jwt_issuer: Optional[str] = None
    jwt_audience: Optional[str] = None

    celery_broker_url: Optional[AnyUrl] = Field(default=None)
    celery_result_backend: Optional[AnyUrl] = Field(default=None)

    celery_default_queue: str = Field(default="crm.default")
    celery_task_routes: dict[str, dict[str, str]] = Field(
        default_factory=lambda: {
            "crm.app.tasks.sync_deal_status": {"queue": "crm.sync"},
            "crm.app.tasks.refresh_policy_state": {"queue": "crm.sync"},
            "crm.app.tasks.process_task_reminders": {"queue": "crm.tasks"},
        }
    )

    events_exchange: str = Field(default="crm.events")
    celery_retry_delay_seconds: int = Field(default=60)

    documents_base_url: AnyUrl = Field(
        ...,
        description=(
            "Базовый URL API сервиса Documents, используемый для получения метаданных "
            "и проверки связей документов."
        ),
    )

    auth_disabled: bool = Field(default=False)

    notifications_dispatch_exchange: str = Field(default="notifications.exchange")
    notifications_dispatch_routing_key: str = Field(default="notifications.dispatch")
    notifications_dispatch_redis_channel: str = Field(default="notifications:dispatch")
    notifications_dispatch_retry_attempts: int = Field(default=3)
    notifications_dispatch_retry_delay_ms: int = Field(default=60_000)
    notifications_queue_name: str = Field(default="notifications.events")
    notifications_queue_routing_key: str = Field(default="notifications.*")
    notifications_queue_durable: bool = Field(default=True)
    notifications_sse_retry_ms: int = Field(default=5_000)
    notifications_templates_default_locale: str = Field(default="ru-RU")
    notifications_telegram_enabled: bool = Field(default=False)
    notifications_telegram_mock: bool = Field(default=True)
    notifications_telegram_bot_token: Optional[str] = Field(default=None)
    notifications_telegram_default_chat_id: Optional[str] = Field(default=None)
    notifications_telegram_webhook_enabled: bool = Field(default=False)
    notifications_telegram_webhook_secret: Optional[str] = Field(default=None)
    notifications_telegram_webhook_signature_header: str = Field(
        default="x-telegram-signature"
    )

    @property
    def resolved_celery_broker(self) -> str:
        return str(self.celery_broker_url or self.redis_url)

    @property
    def resolved_celery_backend(self) -> str:
        return str(self.celery_result_backend or self.redis_url)

    @property
    def resolved_permissions_redis(self) -> str:
        return str(self.permissions_redis_url or self.redis_url)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]


settings = get_settings()
