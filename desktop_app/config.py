"""Configuration module for desktop app"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Configuration
# Используем CRM API напрямую без авторизации (для разработки)
API_BASE_URL = os.getenv("DESKTOP_API_BASE_URL", "http://localhost:8082/api/v1")
API_TIMEOUT = int(os.getenv("DESKTOP_API_TIMEOUT", "10"))

# Service URLs
AUTH_TOKEN_URL = f"{API_BASE_URL}/auth/token"
CRM_CLIENTS_URL = f"{API_BASE_URL}/clients"
CRM_DEALS_URL = f"{API_BASE_URL}/deals"
CRM_PAYMENTS_URL = f"{API_BASE_URL}/payments"
CRM_POLICIES_URL = f"{API_BASE_URL}/policies"
CRM_TASKS_URL = f"{API_BASE_URL}/tasks"

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
