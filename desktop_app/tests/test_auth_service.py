"""Unit tests for AuthService."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, Mock, patch

import httpx
import jwt
import pytest

from core.auth_service import AuthService, AuthToken


class TestAuthToken:
    """Test AuthToken class."""

    def test_auth_token_creation(self) -> None:
        """Test creating an auth token."""
        token = AuthToken(
            access_token="test_token_123",
            token_type="Bearer",
            expires_in=3600,
        )
        assert token.access_token == "test_token_123"
        assert token.token_type == "Bearer"
        assert token.expires_in == 3600

    def test_auth_token_expires_at(self) -> None:
        """Test token expiration time calculation."""
        token = AuthToken(
            access_token="test_token",
            expires_in=3600,
        )
        assert token.expires_at is not None
        # Should be approximately 3600 seconds from now
        time_diff = (token.expires_at - datetime.now(timezone.utc)).total_seconds()
        assert 3595 < time_diff < 3605

    def test_auth_token_is_expired_false(self) -> None:
        """Test token is not expired when freshly created."""
        token = AuthToken(
            access_token="test_token",
            expires_in=3600,  # 1 hour
        )
        assert not token.is_expired()

    def test_auth_token_is_expired_true(self) -> None:
        """Test token is expired when expires_in is in the past."""
        token = AuthToken(
            access_token="test_token",
            expires_in=-100,  # 100 seconds in the past
        )
        assert token.is_expired()

    def test_auth_token_is_expired_with_buffer(self) -> None:
        """Test token expiration with buffer."""
        # Create token that expires in 30 seconds
        token = AuthToken(
            access_token="test_token",
            expires_in=30,
        )
        # With 60 second buffer, token should be considered expired
        assert token.is_expired(buffer_seconds=60)

    def test_auth_token_is_expired_no_expiry(self) -> None:
        """Test token without expiry info is never expired."""
        token = AuthToken(
            access_token="test_token",
            expires_in=None,
        )
        assert not token.is_expired()

    def test_auth_token_user_id_from_sub(self) -> None:
        """Test extracting user ID from 'sub' claim."""
        # Create a valid JWT with 'sub' claim
        payload = {"sub": "user_123"}
        token_str = jwt.encode(payload, "secret", algorithm="HS256")

        token = AuthToken(access_token=token_str)
        assert token.user_id == "user_123"

    def test_auth_token_user_id_from_user_id_claim(self) -> None:
        """Test extracting user ID from 'user_id' claim."""
        payload = {"user_id": "user_456"}
        token_str = jwt.encode(payload, "secret", algorithm="HS256")

        token = AuthToken(access_token=token_str)
        assert token.user_id == "user_456"

    def test_auth_token_user_id_invalid_token(self) -> None:
        """Test user_id returns None for invalid token."""
        token = AuthToken(access_token="not_a_valid_jwt")
        assert token.user_id is None


class TestAuthService:
    """Test AuthService class."""

    def test_auth_service_initialization(self) -> None:
        """Test AuthService initialization."""
        service = AuthService(base_url="http://localhost:8000", timeout=5.0)
        assert service.base_url == "http://localhost:8000"
        assert service.timeout == 5.0
        assert not service.is_authenticated

    def test_auth_service_strips_trailing_slash(self) -> None:
        """Test that trailing slash is removed from base URL."""
        service = AuthService(base_url="http://localhost:8000/")
        assert service.base_url == "http://localhost:8000"

    def test_auth_service_is_authenticated_false_no_token(self) -> None:
        """Test is_authenticated is False when no token."""
        service = AuthService(base_url="http://localhost:8000")
        assert not service.is_authenticated

    def test_auth_service_is_authenticated_false_expired_token(self) -> None:
        """Test is_authenticated is False for expired token."""
        service = AuthService(base_url="http://localhost:8000")
        # Manually set an expired token
        service._token = AuthToken(
            access_token="expired_token",
            expires_in=-100,
        )
        assert not service.is_authenticated

    def test_auth_service_is_authenticated_true(self) -> None:
        """Test is_authenticated is True with valid token."""
        service = AuthService(base_url="http://localhost:8000")
        service._token = AuthToken(
            access_token="valid_token",
            expires_in=3600,
        )
        assert service.is_authenticated

    def test_auth_service_token_property(self) -> None:
        """Test token property returns token when authenticated."""
        service = AuthService(base_url="http://localhost:8000")
        service._token = AuthToken(
            access_token="test_token",
            expires_in=3600,
        )
        assert service.token is not None
        assert service.token.access_token == "test_token"

    def test_auth_service_token_property_none(self) -> None:
        """Test token property returns None when not authenticated."""
        service = AuthService(base_url="http://localhost:8000")
        assert service.token is None

    def test_auth_service_get_auth_header_empty(self) -> None:
        """Test get_auth_header returns empty dict when not authenticated."""
        service = AuthService(base_url="http://localhost:8000")
        assert service.get_auth_header() == {}

    def test_auth_service_get_auth_header_with_token(self) -> None:
        """Test get_auth_header returns Authorization header."""
        service = AuthService(base_url="http://localhost:8000")
        service._token = AuthToken(
            access_token="test_token_123",
            token_type="Bearer",
            expires_in=3600,
        )
        header = service.get_auth_header()
        assert header == {"Authorization": "Bearer test_token_123"}

    @patch("core.auth_service.httpx.Client.post")
    def test_auth_service_login_success(self, mock_post: Mock) -> None:
        """Test successful login."""
        # Mock successful response - Auth service uses camelCase
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "accessToken": "new_token_123",
            "tokenType": "Bearer",
            "expiresIn": 3600,
        }
        mock_post.return_value = mock_response

        service = AuthService(base_url="http://localhost:8000")
        result = service.login("test@example.com", "testpass")

        assert result is True
        assert service.is_authenticated
        assert service.token is not None
        assert service.token.access_token == "new_token_123"

        # Verify POST request was made to correct endpoint with correct payload
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert "/token" in call_args[0][0]
        # Verify JSON payload contains email field
        assert call_args[1]["json"]["email"] == "test@example.com"
        assert call_args[1]["json"]["password"] == "testpass"

    @patch("core.auth_service.httpx.Client.post")
    def test_auth_service_login_invalid_credentials(self, mock_post: Mock) -> None:
        """Test login with invalid credentials."""
        # Mock 401 Unauthorized response
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "401 Unauthorized",
            request=Mock(),
            response=mock_response,
        )
        mock_post.return_value = mock_response

        service = AuthService(base_url="http://localhost:8000")
        result = service.login("testuser", "wrongpass")

        assert result is False
        assert not service.is_authenticated

    @patch("core.auth_service.httpx.Client.post")
    def test_auth_service_login_server_error(self, mock_post: Mock) -> None:
        """Test login with server error."""
        # Mock 500 Server Error
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500 Server Error",
            request=Mock(),
            response=mock_response,
        )
        mock_post.return_value = mock_response

        service = AuthService(base_url="http://localhost:8000")
        result = service.login("testuser", "testpass")

        assert result is False
        assert not service.is_authenticated

    @patch("core.auth_service.httpx.Client.post")
    def test_auth_service_login_network_error(self, mock_post: Mock) -> None:
        """Test login with network error."""
        mock_post.side_effect = httpx.NetworkError("Connection refused")

        service = AuthService(base_url="http://localhost:8000")
        result = service.login("testuser", "testpass")

        assert result is False
        assert not service.is_authenticated

    def test_auth_service_refresh_no_token(self) -> None:
        """Test refresh without token returns False."""
        service = AuthService(base_url="http://localhost:8000")
        assert service.refresh() is False

    def test_auth_service_refresh_valid_token(self) -> None:
        """Test refresh with valid token."""
        service = AuthService(base_url="http://localhost:8000")
        service._token = AuthToken(
            access_token="valid_token",
            expires_in=3600,
        )
        # Refresh should return True if token is still valid
        assert service.refresh() is True

    def test_auth_service_logout(self) -> None:
        """Test logout clears token."""
        service = AuthService(base_url="http://localhost:8000")
        service._token = AuthToken(
            access_token="test_token",
            expires_in=3600,
        )
        assert service.is_authenticated

        service.logout()

        assert not service.is_authenticated
        assert service.token is None

    def test_auth_service_context_manager(self) -> None:
        """Test AuthService as context manager."""
        service = AuthService(base_url="http://localhost:8000")
        with service:
            assert service is not None
        # Should not raise

    def test_auth_service_close(self) -> None:
        """Test close method closes HTTP client."""
        service = AuthService(base_url="http://localhost:8000")
        service.close()
        # Should not raise
