"""Authentication service for managing JWT tokens and user sessions."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import jwt

logger = logging.getLogger(__name__)


@dataclass
class AuthToken:
    """JWT token with metadata."""
    access_token: str
    token_type: str = "Bearer"
    expires_in: Optional[int] = None

    @property
    def expires_at(self) -> Optional[datetime]:
        """Calculate expiration time from expires_in."""
        if self.expires_in is None:
            return None
        return datetime.now(timezone.utc) + timedelta(seconds=self.expires_in)

    def is_expired(self, buffer_seconds: int = 60) -> bool:
        """Check if token is expired (with buffer for refresh)."""
        if self.expires_at is None:
            return False
        return datetime.now(timezone.utc) >= (self.expires_at - timedelta(seconds=buffer_seconds))

    @property
    def user_id(self) -> Optional[str]:
        """Extract user ID from token payload without verification."""
        try:
            # Decode without verification to get claims (not secure but OK for local desktop app)
            payload = jwt.decode(self.access_token, options={"verify_signature": False})
            return payload.get("sub") or payload.get("user_id")
        except Exception:
            return None


class AuthService:
    """Service for handling authentication with the API."""

    def __init__(self, base_url: str, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._token: Optional[AuthToken] = None
        self._http_client = httpx.Client(timeout=timeout)

    @property
    def is_authenticated(self) -> bool:
        """Check if user is authenticated with valid token."""
        return self._token is not None and not self._token.is_expired()

    @property
    def token(self) -> Optional[AuthToken]:
        """Get current authentication token."""
        return self._token if self.is_authenticated else None

    def get_auth_header(self) -> dict[str, str]:
        """Get Authorization header for API requests."""
        if not self.token or not self.token.access_token:
            return {}
        return {"Authorization": f"{self.token.token_type} {self.token.access_token}"}

    def login(self, username: str, password: str) -> bool:
        """
        Authenticate user with email and password.

        Args:
            username: Email address for authentication (treated as email)
            password: Password for authentication

        Returns:
            True if authentication successful, False otherwise
        """
        try:
            # Prepare login payload - Auth service expects email and password as JSON
            payload = {
                "email": username,  # Username field actually contains email
                "password": password,
            }

            # Make POST request to /token endpoint
            response = self._http_client.post(
                f"{self.base_url}/token",
                json=payload,
            )
            response.raise_for_status()

            # Parse response and extract token
            # Auth service returns camelCase: accessToken, tokenType, expiresIn
            data = response.json()
            self._token = AuthToken(
                access_token=data.get("accessToken", ""),
                token_type=data.get("tokenType", "Bearer"),
                expires_in=data.get("expiresIn"),
            )

            logger.info("User authenticated successfully: %s", username)
            return True

        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 401:
                logger.warning("Authentication failed: invalid credentials")
            else:
                logger.error("Authentication request failed: %s", exc)
            return False
        except Exception as exc:
            logger.error("Authentication error: %s", exc)
            return False

    def refresh(self) -> bool:
        """
        Refresh the authentication token using refresh token.

        Note: This is a placeholder for when refresh token support is added to the API.

        Returns:
            True if refresh successful, False otherwise
        """
        if not self._token:
            logger.warning("Cannot refresh: no token available")
            return False

        try:
            # TODO: Implement refresh token endpoint when available
            # For now, just check if current token is still valid
            return self.is_authenticated

        except Exception as exc:
            logger.error("Token refresh error: %s", exc)
            return False

    def logout(self) -> None:
        """Clear authentication token and logout user."""
        self._token = None
        logger.info("User logged out")

    def close(self) -> None:
        """Close HTTP client."""
        self._http_client.close()

    def __enter__(self) -> "AuthService":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()
