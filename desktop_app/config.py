from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


def _normalize_base_url(raw_url: str | None) -> str:
    if not raw_url:
        return "http://localhost:8080/api/v1/crm"

    normalized = raw_url.rstrip("/")
    if normalized.endswith("/api/v1") and not normalized.endswith("/api/v1/crm"):
        normalized = f"{normalized}/crm"
    return normalized


@dataclass(slots=True)
class Settings:
    api_base_url: str = "http://localhost:8080/api/v1/crm"
    api_timeout: float = 10.0
    log_level: str = "INFO"
    journal_author_id: str | None = None


@lru_cache(maxsize=1)
def get_settings(env_path: Path | None = None) -> Settings:
    """Load application settings from .env (once)."""
    env_path = env_path or Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)

    api_base_url = _normalize_base_url(os.getenv("DESKTOP_API_BASE_URL"))
    timeout_env = os.getenv("DESKTOP_API_TIMEOUT", "10")
    try:
        api_timeout = float(timeout_env)
    except ValueError:
        api_timeout = 10.0

    settings = Settings(
        api_base_url=api_base_url,
        api_timeout=api_timeout,
        log_level=os.getenv("DESKTOP_LOG_LEVEL", "INFO").upper(),
        journal_author_id=os.getenv("DESKTOP_JOURNAL_AUTHOR_ID"),
    )
    return settings

