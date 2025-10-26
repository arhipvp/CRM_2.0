"""Configuration module for desktop app"""
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv


def normalize_api_base_url(raw_url: Optional[str]) -> Optional[str]:
    """Normalize the API base URL expected by the desktop application.

    Gateway проксирует CRM под путём ``/api/v1/crm``. Разработчики часто
    прокидывают ``DESKTOP_API_BASE_URL`` без суффикса ``/crm`` (``/api/v1``),
    что приводит к обращению к корневому пространству Gateway и 404 на CRM
    эндпоинтах. Функция дописывает ``/crm`` только если путь явно заканчивается
    на ``/api/v1`` и суффикс отсутствует. Остальные значения возвращаются без
    изменений, чтобы поддерживать прямые подключения к CRM без Gateway.
    """

    if not raw_url:
        return raw_url

    normalized = raw_url.rstrip("/")

    if normalized.endswith("/api/v1") and not normalized.endswith("/api/v1/crm"):
        normalized = f"{normalized}/crm"

    return normalized


# Load environment variables
load_dotenv()

# API Configuration
# Используем CRM API напрямую без авторизации (для разработки)
API_BASE_URL = normalize_api_base_url(
    os.getenv("DESKTOP_API_BASE_URL", "http://localhost:8082/api/v1")
)
API_TIMEOUT = int(os.getenv("DESKTOP_API_TIMEOUT", "10"))

# Deal journal configuration
DEFAULT_JOURNAL_AUTHOR_ID = os.getenv("DESKTOP_JOURNAL_AUTHOR_ID")

# Service URLs
AUTH_TOKEN_URL = f"{API_BASE_URL}/auth/token"
CRM_CLIENTS_URL = f"{API_BASE_URL}/clients"
CRM_DEALS_URL = f"{API_BASE_URL}/deals"
CRM_PAYMENTS_URL = f"{API_BASE_URL}/payments"
CRM_POLICIES_URL = f"{API_BASE_URL}/policies"
CRM_TASKS_URL = f"{API_BASE_URL}/tasks"
CRM_USERS_URL = f"{API_BASE_URL}/users"

# Documents configuration
DEAL_DOCUMENTS_ROOT = Path(
    os.getenv(
        "DESKTOP_DEAL_DOCUMENTS_ROOT",
        Path.cwd() / "deal_documents",
    )
)
DEAL_DOCUMENTS_ROOT.mkdir(parents=True, exist_ok=True)

# Logging Configuration
LOG_LEVEL = os.getenv("DESKTOP_LOG_LEVEL", "INFO")
