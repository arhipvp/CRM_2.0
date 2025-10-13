"""Configuration for the Reports service."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_prefix="REPORTS_", env_file=None, case_sensitive=False)

    service_host: str = "0.0.0.0"
    service_port: int = 8087
    database_url: str = "postgresql://reports:reports@localhost:5432/crm?search_path=reports"
    crm_schema: str = "crm"
    audit_schema: str = "audit"
    reports_schema: str = "reports"
    source_schemas: str | None = None

    @property
    def async_database_url(self) -> str:
        """Return an async-compatible SQLAlchemy URL."""

        if self.database_url.startswith("postgresql+asyncpg://"):
            return self.database_url
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return self.database_url

    @property
    def source_schema_list(self) -> list[str]:
        """A normalized list of upstream schemas."""

        if self.source_schemas:
            return [item.strip() for item in self.source_schemas.split(",") if item.strip()]
        return [self.crm_schema, self.audit_schema]


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()


__all__ = ["Settings", "get_settings"]
