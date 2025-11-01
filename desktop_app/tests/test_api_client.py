"""Unit tests for APIClient."""

from __future__ import annotations

from unittest.mock import Mock, patch

import httpx
import pytest

from api.client import APIClient, APIClientError
from models import Client, Deal


class TestAPIClient:
    """Test APIClient class."""

    def test_api_client_initialization(self) -> None:
        """Test APIClient initialization."""
        client = APIClient(base_url="http://localhost:8000", timeout=5.0)
        # httpx normalizes base_url without trailing slash
        assert str(client._client.base_url) == "http://localhost:8000"
        # Verify client is initialized
        assert client._client is not None

    def test_api_client_initialization_with_auth(self) -> None:
        """Test APIClient initialization with auth header callback."""
        auth_header_func = lambda: {"Authorization": "Bearer test_token"}
        client = APIClient(
            base_url="http://localhost:8000",
            get_auth_header=auth_header_func,
        )
        assert client._get_auth_header() == {"Authorization": "Bearer test_token"}

    @patch("api.client.APIClient._request")
    def test_api_client_fetch_clients(self, mock_request: Mock) -> None:
        """Test fetch_clients makes correct API request."""
        from uuid import uuid4

        mock_response = Mock()
        client_id = str(uuid4())
        mock_response.json.return_value = [
            {
                "id": client_id,
                "name": "Test Client",
                "email": "test@example.com",
                "phone": "1234567890",
                "status": "active",
                "created_at": "2025-01-01T00:00:00Z",
                "updated_at": "2025-01-01T00:00:00Z",
            }
        ]
        mock_request.return_value = mock_response

        client = APIClient(base_url="http://localhost:8000")
        result = client.fetch_clients()

        assert len(result) == 1
        assert result[0].name == "Test Client"
        mock_request.assert_called_once_with("GET", "/clients", params=None)

    @patch("api.client.APIClient._request")
    def test_api_client_fetch_deals(self, mock_request: Mock) -> None:
        """Test fetch_deals makes correct API request."""
        from uuid import uuid4

        mock_response = Mock()
        deal_id = str(uuid4())
        client_id = str(uuid4())
        mock_response.json.return_value = [
            {
                "id": deal_id,
                "title": "Test Deal",
                "client_id": client_id,
                "status": "open",
                "created_at": "2025-01-01T00:00:00Z",
                "updated_at": "2025-01-01T00:00:00Z",
            }
        ]
        mock_request.return_value = mock_response

        client = APIClient(base_url="http://localhost:8000")
        result = client.fetch_deals()

        assert len(result) == 1
        assert result[0].title == "Test Deal"
        mock_request.assert_called_once_with("GET", "/deals", params=None)

    @patch("api.client.APIClient._request")
    def test_api_client_create_client(self, mock_request: Mock) -> None:
        """Test create_client makes correct API request."""
        from uuid import uuid4

        mock_response = Mock()
        client_id = str(uuid4())
        mock_response.json.return_value = {
            "id": client_id,
            "name": "New Client",
            "email": "new@example.com",
            "phone": "9876543210",
            "status": "active",
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-01T00:00:00Z",
        }
        mock_request.return_value = mock_response

        client = APIClient(base_url="http://localhost:8000")
        payload = {"name": "New Client", "email": "new@example.com"}
        result = client.create_client(payload)

        assert result.name == "New Client"
        assert result.email == "new@example.com"
        mock_request.assert_called_once_with("POST", "/clients", json=payload)

    @patch("api.client.httpx.Client.request")
    def test_api_client_request_with_auth_header(self, mock_request: Mock) -> None:
        """Test that _request includes auth header."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = []
        mock_request.return_value = mock_response

        auth_header = {"Authorization": "Bearer test_token_123"}
        client = APIClient(
            base_url="http://localhost:8000",
            get_auth_header=lambda: auth_header,
        )

        # Call _request which should add auth header
        client._request("GET", "/test")

        # Verify request was called with auth header
        mock_request.assert_called_once()
        call_kwargs = mock_request.call_args[1]
        assert call_kwargs["headers"] == auth_header

    @patch("api.client.httpx.Client.request")
    def test_api_client_request_retry_on_network_error(self, mock_request: Mock) -> None:
        """Test automatic retry on network error."""
        # Simulate: fail twice, succeed on third attempt
        mock_request.side_effect = [
            httpx.NetworkError("Connection refused"),
            httpx.NetworkError("Connection refused"),
            self._create_mock_response(200, []),
        ]

        client = APIClient(base_url="http://localhost:8000")

        # Patch time.sleep to avoid delays in tests
        with patch("api.client.time.sleep"):
            result = client._request("GET", "/test")

        assert result.status_code == 200
        assert mock_request.call_count == 3

    @patch("api.client.httpx.Client.request")
    def test_api_client_request_retry_on_server_error(self, mock_request: Mock) -> None:
        """Test automatic retry on server error (5xx)."""
        error_response = Mock()
        error_response.status_code = 503
        error_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "503 Service Unavailable",
            request=Mock(),
            response=error_response,
        )

        # Fail twice with 503, succeed on third
        mock_request.side_effect = [
            error_response,
            error_response,
            self._create_mock_response(200, []),
        ]

        client = APIClient(base_url="http://localhost:8000")

        with patch("api.client.time.sleep"):
            result = client._request("GET", "/test")

        assert result.status_code == 200
        assert mock_request.call_count == 3

    @patch("api.client.httpx.Client.request")
    def test_api_client_request_no_retry_on_client_error(self, mock_request: Mock) -> None:
        """Test no retry on client error (4xx except 429)."""
        error_response = Mock()
        error_response.status_code = 404
        error_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "404 Not Found",
            request=Mock(),
            response=error_response,
        )
        mock_request.return_value = error_response

        client = APIClient(base_url="http://localhost:8000")

        with pytest.raises(APIClientError):
            client._request("GET", "/nonexistent")

        # Should not retry on 404
        assert mock_request.call_count == 1

    @patch("api.client.httpx.Client.request")
    def test_api_client_request_retry_on_rate_limit(self, mock_request: Mock) -> None:
        """Test retry on rate limit (429)."""
        error_response = Mock()
        error_response.status_code = 429
        error_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "429 Too Many Requests",
            request=Mock(),
            response=error_response,
        )

        # Fail with 429, succeed on second attempt
        mock_request.side_effect = [
            error_response,
            self._create_mock_response(200, []),
        ]

        client = APIClient(base_url="http://localhost:8000")

        with patch("api.client.time.sleep"):
            result = client._request("GET", "/test")

        assert result.status_code == 200
        assert mock_request.call_count == 2

    @patch("api.client.httpx.Client.request")
    def test_api_client_request_max_retries_exceeded(self, mock_request: Mock) -> None:
        """Test error raised after max retries exceeded."""
        mock_request.side_effect = httpx.NetworkError("Connection refused")

        client = APIClient(base_url="http://localhost:8000")

        with patch("api.client.time.sleep"):
            with pytest.raises(APIClientError):
                client._request("GET", "/test", max_retries=3)

        # Should attempt 3 times
        assert mock_request.call_count == 3

    @patch("api.client.httpx.Client.request")
    def test_api_client_request_timeout_error(self, mock_request: Mock) -> None:
        """Test retry on timeout error."""
        # Fail with timeout, succeed on second attempt
        mock_request.side_effect = [
            httpx.TimeoutException("Request timed out"),
            self._create_mock_response(200, []),
        ]

        client = APIClient(base_url="http://localhost:8000")

        with patch("api.client.time.sleep"):
            result = client._request("GET", "/test")

        assert result.status_code == 200
        assert mock_request.call_count == 2

    @staticmethod
    def _create_mock_response(status_code: int, json_data: dict | list) -> Mock:
        """Helper to create a mock HTTP response."""
        response = Mock()
        response.status_code = status_code
        response.json.return_value = json_data
        response.raise_for_status.return_value = None
        return response

    def test_api_client_context_manager(self) -> None:
        """Test APIClient as context manager."""
        with APIClient(base_url="http://localhost:8000") as client:
            assert client is not None
        # Should not raise

    def test_api_client_close(self) -> None:
        """Test close method."""
        client = APIClient(base_url="http://localhost:8000")
        client.close()
        # Should not raise
