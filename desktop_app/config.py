"""Configuration module for desktop app"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Configuration
API_BASE_URL = os.getenv("DESKTOP_API_BASE_URL", "http://localhost:8080/api/v1")
API_TIMEOUT = int(os.getenv("DESKTOP_API_TIMEOUT", "10"))

# Service URLs
AUTH_TOKEN_URL = f"{API_BASE_URL}/auth/token"
CRM_CLIENTS_URL = f"{API_BASE_URL}/crm/clients"
CRM_DEALS_URL = f"{API_BASE_URL}/crm/deals"
CRM_PAYMENTS_URL = f"{API_BASE_URL}/crm/payments"

# Logging Configuration
LOG_LEVEL = os.getenv("DESKTOP_LOG_LEVEL", "INFO")
