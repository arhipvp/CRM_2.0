"""Authentication service module"""
from typing import Optional, Dict, Any
import requests
from config import AUTH_TOKEN_URL, API_TIMEOUT
from logger import logger


class AuthService:
    """Service for authentication operations"""

    @staticmethod
    def login(username: str, password: str) -> Optional[str]:
        """Authenticate user and return access token"""
        try:
            response = requests.post(
                AUTH_TOKEN_URL,
                json={"username": username, "password": password},
                timeout=API_TIMEOUT
            )
            response.raise_for_status()
            token_data = response.json()
            access_token = token_data.get("accessToken")
            if access_token:
                logger.info(f"User {username} authenticated successfully")
                return access_token
            else:
                logger.error("Invalid token response from server")
                return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Authentication failed: {e}")
            raise
