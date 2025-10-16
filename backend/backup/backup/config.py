from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field, ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class SchedulerSettings(BaseModel):
    enabled: bool = Field(default=True, description="Включать запуск планировщика APScheduler")
    poll_interval_seconds: int = Field(default=60, ge=5, description="Интервал опроса базы на предмет обновлений расписаний")


class Settings(BaseSettings):
    """Настройки Backup сервиса."""

    model_config = SettingsConfigDict(env_prefix="BACKUP_", case_sensitive=False, extra="ignore")

    service_port: int = Field(default=8094, description="Порт HTTP-сервиса")
    timezone: str = Field(default="Europe/Moscow", description="Часовой пояс расписаний")

    database_url: str = Field(..., description="DSN PostgreSQL для хранения расписаний и журналов выполнения")

    s3_endpoint_url: Optional[str] = Field(default=None, description="Пользовательская точка доступа S3")
    s3_region_name: str = Field(default="us-east-1", description="Регион S3")
    s3_access_key: Optional[str] = Field(default=None, description="Ключ доступа S3")
    s3_secret_key: Optional[str] = Field(default=None, description="Секретный ключ доступа S3")
    s3_bucket: Optional[str] = Field(default=None, description="Бакет для артефактов бэкапов")
    s3_prefix: str = Field(default="backups", description="Префикс ключей в бакете")

    rabbitmq_url: str = Field(..., description="AMQP URL для публикации уведомлений")
    notification_exchange: str = Field(default="backup.notifications", description="Exchange RabbitMQ для уведомлений")
    notification_routing_key: str = Field(default="jobs", description="Routing key для уведомлений")

    postgres_backup_dsn: str = Field(..., description="Строка подключения к PostgreSQL-кластеру, который требуется резервировать")
    pg_dump_path: str = Field(default="pg_dump", description="Путь к исполняемому файлу pg_dump")
    pg_basebackup_path: str = Field(default="pg_basebackup", description="Путь к исполняемому файлу pg_basebackup")

    consul_binary: str = Field(default="consul", description="Путь к бинарнику consul")
    consul_http_addr: str = Field(..., description="HTTP-адрес Consul API")
    consul_token: Optional[str] = Field(default=None, description="ACL-токен Consul")

    rabbitmq_admin_binary: str = Field(default="rabbitmqadmin", description="Путь к бинарнику rabbitmqadmin")
    rabbitmq_management_url: str = Field(..., description="URL RabbitMQ Management API")
    rabbitmq_admin_user: str = Field(..., description="Пользователь rabbitmqadmin")
    rabbitmq_admin_password: str = Field(..., description="Пароль rabbitmqadmin")
    rabbitmq_vhost: str = Field(default="/", description="VHost RabbitMQ для экспорта конфигурации")

    redis_cli_binary: str = Field(default="redis-cli", description="Путь к redis-cli")
    redis_host: str = Field(default="localhost", description="Хост Redis")
    redis_port: int = Field(default=6379, description="Порт Redis")
    redis_username: Optional[str] = Field(default=None, description="Пользователь Redis")
    redis_password: Optional[str] = Field(default=None, description="Пароль Redis")
    redis_use_tls: bool = Field(default=False, description="Использовать TLS для подключения к Redis")
    redis_data_dir: Optional[Path] = Field(default=None, description="Локальный путь с файлами Redis для копирования AOF")

    artifacts_dir: Path = Field(default=Path("/tmp/backup-artifacts"), description="Локальный каталог для временных артефактов")

    scheduler: SchedulerSettings = Field(default_factory=SchedulerSettings, description="Настройки планировщика")

    health_timeout_seconds: float = Field(default=2.0, description="Таймаут проверок здоровья зависимостей")

    @field_validator(
        "s3_endpoint_url",
        "s3_access_key",
        "s3_secret_key",
        "s3_bucket",
        "consul_token",
        "redis_username",
        "redis_password",
        mode="before",
    )
    @classmethod
    def _empty_string_to_none(
        cls, value: Optional[str], info: ValidationInfo
    ) -> Optional[str]:
        if not isinstance(value, str):
            return value

        value = value.strip()
        if value == "":
            return None

        if info.field_name == "s3_endpoint_url" and not value.startswith(("http://", "https://")):
            raise ValueError("S3 endpoint URL должен начинаться с http:// или https://")

        return value

    @field_validator("redis_data_dir", mode="before")
    @classmethod
    def _empty_path_to_none(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return None

        return value

    @field_validator("s3_region_name", mode="before")
    @classmethod
    def _normalize_region_name(cls, value: object) -> object:
        if value is None:
            return "us-east-1"

        if isinstance(value, str):
            normalized = value.strip()
            if normalized == "":
                return "us-east-1"
            return normalized

        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]
