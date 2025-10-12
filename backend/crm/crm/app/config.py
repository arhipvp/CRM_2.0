from functools import lru_cache
from typing import Optional

from pydantic import AnyUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="CRM_", case_sensitive=False)

    app_name: str = Field(default="CRM Deals Service")
    api_prefix: str = Field(default="/api/v1")

    service_host: str = Field(default="0.0.0.0", alias="service_host")
    service_port: int = Field(default=8082, alias="service_port")

    database_url: AnyUrl = Field(..., alias="database_url")
    redis_url: AnyUrl = Field(..., alias="redis_url")
    rabbitmq_url: AnyUrl = Field(..., alias="rabbitmq_url")

    celery_broker_url: Optional[AnyUrl] = Field(default=None, alias="celery_broker_url")
    celery_result_backend: Optional[AnyUrl] = Field(default=None, alias="celery_result_backend")

    celery_default_queue: str = Field(default="crm.default")
    celery_task_routes: dict[str, dict[str, str]] = Field(
        default_factory=lambda: {
            "crm.app.tasks.sync_deal_status": {"queue": "crm.sync"},
            "crm.app.tasks.refresh_policy_state": {"queue": "crm.sync"},
        }
    )

    events_exchange: str = Field(default="crm.events")
    payments_exchange: str = Field(default="payments.events")
    payments_queue: str = Field(default="crm.payments-sync")
    payments_retry_exchange: str = Field(default="crm.payments-sync.retry")
    payments_retry_queue: str = Field(default="crm.payments-sync.retry")
    payments_dlx_exchange: str = Field(default="crm.payments-sync.dlx")
    payments_dlx_queue: str = Field(default="crm.payments-sync.dlx")
    payments_retry_delay_ms: int = Field(default=60_000)
    payments_retry_limit: int = Field(default=5)
    enable_payments_consumer: bool = Field(default=True, alias="enable_payments_consumer")

    default_tenant_id: Optional[str] = None

    @property
    def resolved_celery_broker(self) -> str:
        return str(self.celery_broker_url or self.redis_url)

    @property
    def resolved_celery_backend(self) -> str:
        return str(self.celery_result_backend or self.redis_url)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]


settings = get_settings()
