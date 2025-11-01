"""Unit tests for AppContext and DataCache."""

from __future__ import annotations

from uuid import UUID, uuid4
from unittest.mock import Mock, patch

import pytest

from core.app_context import AppContext, DataCache, init_app_context, get_app_context
from config import Settings
from models import Client, Deal, Policy, Task


class TestDataCache:
    """Test DataCache class."""

    def test_data_cache_initialization(self) -> None:
        """Test DataCache initializes with empty dicts."""
        cache = DataCache()
        assert cache.clients == {}
        assert cache.deals == {}
        assert cache.policies == {}
        assert cache.tasks == {}

    def test_data_cache_store_and_retrieve_client(self) -> None:
        """Test storing and retrieving clients."""
        cache = DataCache()
        client_id = uuid4()
        client = Client(
            id=client_id,
            name="Test Client",
            email="test@example.com",
            phone="1234567890",
            status="active",
        )

        cache.clients[client_id] = client

        assert client_id in cache.clients
        assert cache.clients[client_id].name == "Test Client"

    def test_data_cache_multiple_entries(self) -> None:
        """Test storing multiple cache entries."""
        cache = DataCache()
        client_ids = [uuid4(), uuid4(), uuid4()]

        for i, client_id in enumerate(client_ids):
            client = Client(
                id=client_id,
                name=f"Client {i}",
                email=f"client{i}@example.com",
            )
            cache.clients[client_id] = client

        assert len(cache.clients) == 3
        assert all(cid in cache.clients for cid in client_ids)


class TestAppContext:
    """Test AppContext class."""

    @patch("core.app_context.APIClient")
    def test_app_context_initialization(self, mock_api_client: Mock) -> None:
        """Test AppContext initialization."""
        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )

        context = AppContext(settings=settings)

        assert context.settings == settings
        assert context.auth_service is not None
        assert context.api is not None
        assert isinstance(context.cache, DataCache)

    @patch("core.app_context.APIClient")
    def test_app_context_update_clients(self, mock_api_client: Mock) -> None:
        """Test updating clients in cache."""
        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )
        context = AppContext(settings=settings)

        client_id = uuid4()
        client = Client(
            id=client_id,
            name="Test Client",
            email="test@example.com",
        )

        context.update_clients([client])

        assert client_id in context.cache.clients
        assert context.cache.clients[client_id].name == "Test Client"

    @patch("core.app_context.APIClient")
    def test_app_context_update_deals(self, mock_api_client: Mock) -> None:
        """Test updating deals in cache."""
        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )
        context = AppContext(settings=settings)

        deal_id = uuid4()
        deal = Deal(
            id=deal_id,
            title="Test Deal",
            client_id=uuid4(),
        )

        context.update_deals([deal])

        assert deal_id in context.cache.deals
        assert context.cache.deals[deal_id].title == "Test Deal"

    @patch("core.app_context.APIClient")
    def test_app_context_update_policies(self, mock_api_client: Mock) -> None:
        """Test updating policies in cache."""
        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )
        context = AppContext(settings=settings)

        policy_id = uuid4()
        policy = Policy(
            id=policy_id,
            policy_number="POL-001",
            client_id=uuid4(),
        )

        context.update_policies([policy])

        assert policy_id in context.cache.policies
        assert context.cache.policies[policy_id].policy_number == "POL-001"

    @patch("core.app_context.APIClient")
    def test_app_context_update_tasks(self, mock_api_client: Mock) -> None:
        """Test updating tasks in cache."""
        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )
        context = AppContext(settings=settings)

        task_id = uuid4()
        task = Task(
            id=task_id,
            title="Test Task",
        )

        context.update_tasks([task])

        assert task_id in context.cache.tasks
        assert context.cache.tasks[task_id].title == "Test Task"

    @patch("core.app_context.APIClient")
    def test_app_context_get_client_name(self, mock_api_client: Mock) -> None:
        """Test get_client_name lookup."""
        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )
        context = AppContext(settings=settings)

        client_id = uuid4()
        client = Client(
            id=client_id,
            name="Test Client",
            email="test@example.com",
        )
        context.update_clients([client])

        name = context.get_client_name(client_id)
        assert name == "Test Client"

    @patch("core.app_context.APIClient")
    def test_app_context_get_client_name_not_found(self, mock_api_client: Mock) -> None:
        """Test get_client_name with unknown client ID."""
        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )
        context = AppContext(settings=settings)

        name = context.get_client_name(uuid4())
        # Should return empty string if not found
        assert name == ""

    @patch("core.app_context.APIClient")
    def test_app_context_get_client_name_none_id(self, mock_api_client: Mock) -> None:
        """Test get_client_name with None ID."""
        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )
        context = AppContext(settings=settings)

        name = context.get_client_name(None)
        assert name == ""

    @patch("core.app_context.APIClient")
    def test_app_context_get_deal_title(self, mock_api_client: Mock) -> None:
        """Test get_deal_title lookup."""
        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )
        context = AppContext(settings=settings)

        deal_id = uuid4()
        deal = Deal(
            id=deal_id,
            title="Test Deal",
            client_id=uuid4(),
        )
        context.update_deals([deal])

        title = context.get_deal_title(deal_id)
        assert title == "Test Deal"

    @patch("core.app_context.APIClient")
    def test_app_context_get_deal_title_not_found(self, mock_api_client: Mock) -> None:
        """Test get_deal_title with unknown deal ID."""
        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )
        context = AppContext(settings=settings)

        title = context.get_deal_title(uuid4())
        assert title == ""

    @patch("core.app_context.APIClient")
    def test_app_context_get_policy_number(self, mock_api_client: Mock) -> None:
        """Test get_policy_number lookup."""
        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )
        context = AppContext(settings=settings)

        policy_id = uuid4()
        policy = Policy(
            id=policy_id,
            policy_number="POL-12345",
            client_id=uuid4(),
        )
        context.update_policies([policy])

        number = context.get_policy_number(policy_id)
        assert number == "POL-12345"

    @patch("core.app_context.APIClient")
    def test_app_context_close(self, mock_api_client: Mock) -> None:
        """Test close method."""
        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )
        context = AppContext(settings=settings)
        context.close()
        # Should not raise

    @patch("core.app_context.APIClient")
    def test_app_context_with_auth_service(self, mock_api_client: Mock) -> None:
        """Test AppContext initialization with provided auth service."""
        from core.auth_service import AuthService

        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )
        auth_service = AuthService(
            base_url="http://localhost:8000",
            timeout=10.0,
        )

        context = AppContext(settings=settings, auth_service=auth_service)

        assert context.auth_service is auth_service
        # Verify API client was initialized with auth service's header method
        mock_api_client.assert_called_once()
        call_kwargs = mock_api_client.call_args[1]
        assert "get_auth_header" in call_kwargs


class TestAppContextGlobal:
    """Test global AppContext singleton."""

    def test_init_app_context_creates_singleton(self) -> None:
        """Test init_app_context creates a singleton."""
        # Reset global context
        import core.app_context
        core.app_context._GLOBAL_CONTEXT = None

        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )

        context1 = init_app_context(settings)
        context2 = init_app_context(settings)

        # Should be the same instance
        assert context1 is context2

    def test_get_app_context_returns_singleton(self) -> None:
        """Test get_app_context returns the singleton."""
        import core.app_context
        core.app_context._GLOBAL_CONTEXT = None

        settings = Settings(
            api_base_url="http://localhost:8000",
            api_timeout=10.0,
        )
        init_app_context(settings)

        context = get_app_context()
        assert context is not None
        assert context.settings == settings

    def test_get_app_context_creates_if_not_exists(self) -> None:
        """Test get_app_context creates context if it doesn't exist."""
        import core.app_context
        core.app_context._GLOBAL_CONTEXT = None

        context = get_app_context()
        assert context is not None
        assert context.settings is not None
