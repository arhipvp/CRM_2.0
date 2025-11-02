from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Callable, Dict, Iterable, List, Optional, Sequence
from uuid import UUID

import httpx

from models import Client, Deal, Payment, Policy, StatCounters, Task

logger = logging.getLogger(__name__)


class APIClientError(RuntimeError):
    """Raised when the CRM API request fails."""


class APIClient:
    def __init__(
        self,
        base_url: str,
        timeout: float = 10.0,
        get_auth_header: Optional[Callable[[], dict[str, str]]] = None,
    ) -> None:
        self._client = httpx.Client(base_url=base_url, timeout=timeout)
        self._get_auth_header = get_auth_header or (lambda: {})

    def close(self) -> None:
        self._client.close()

    # ----- internal helpers -------------------------------------------------
    def _request(
        self,
        method: str,
        url: str,
        max_retries: int = 3,
        **kwargs,
    ) -> httpx.Response:
        """
        Make HTTP request with automatic retry on network errors.

        Args:
            method: HTTP method (GET, POST, etc.)
            url: Request URL
            max_retries: Maximum number of retry attempts (default 3)
            **kwargs: Additional arguments to pass to httpx

        Returns:
            HTTP response

        Raises:
            APIClientError: If request fails after all retries
        """
        # Add authentication header if available
        headers = kwargs.get("headers", {})
        auth_header = self._get_auth_header()
        if auth_header:
            headers.update(auth_header)
            kwargs["headers"] = headers

        last_exception = None
        for attempt in range(max_retries):
            try:
                response = self._client.request(method, url, **kwargs)
                response.raise_for_status()
                return response

            except httpx.HTTPStatusError as exc:
                # Don't retry on 4xx errors (client errors) except 429 (rate limited)
                if 400 <= exc.response.status_code < 500 and exc.response.status_code != 429:
                    logger.error("Client error %d: %s", exc.response.status_code, url)
                    raise APIClientError(str(exc)) from exc

                # Retry on 5xx errors (server errors) and 429 (rate limited)
                last_exception = exc
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
                    logger.warning(
                        "Server error %d on %s, retrying in %ds (attempt %d/%d)",
                        exc.response.status_code,
                        url,
                        wait_time,
                        attempt + 1,
                        max_retries,
                    )
                    time.sleep(wait_time)

            except (httpx.NetworkError, httpx.TimeoutException) as exc:
                # Retry on network and timeout errors
                last_exception = exc
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt)
                    logger.warning(
                        "Network error on %s: %s, retrying in %ds (attempt %d/%d)",
                        url,
                        str(exc),
                        wait_time,
                        attempt + 1,
                        max_retries,
                    )
                    time.sleep(wait_time)

            except httpx.HTTPError as exc:
                # Other HTTP errors - don't retry
                logger.error("HTTP error: %s", exc)
                raise APIClientError(str(exc)) from exc

        # All retries exhausted
        logger.error("Failed after %d retries: %s", max_retries, last_exception)
        raise APIClientError(f"Request failed after {max_retries} retries: {last_exception}") from last_exception

    def _get(self, url: str, params: dict | None = None) -> dict | list:
        return self._request("GET", url, params=params).json()

    # ----- public API: clients ---------------------------------------------
    def fetch_clients(self) -> List[Client]:
        data = self._get("/clients")
        return [Client.model_validate(item) for item in data if not item.get("isDeleted")]

    def create_client(self, payload: Dict[str, Optional[str]]) -> Client:
        response = self._request("POST", "/clients", json=payload)
        return Client.model_validate(response.json())

    def update_client(self, client_id: UUID, payload: Dict[str, Optional[str]]) -> Client:
        response = self._request("PATCH", f"/clients/{client_id}", json=payload)
        return Client.model_validate(response.json())

    def delete_client(self, client_id: UUID) -> None:
        payload = {
            "is_deleted": True,
        }
        self._request("PATCH", f"/clients/{client_id}", json=payload)

    # ----- public API: deals -----------------------------------------------
    def fetch_deals(self) -> List[Deal]:
        data = self._get("/deals")
        return [Deal.model_validate(item) for item in data if not item.get("isDeleted")]

    def create_deal(self, payload: Dict[str, object]) -> Deal:
        response = self._request("POST", "/deals", json=payload)
        return Deal.model_validate(response.json())

    def update_deal(self, deal_id: UUID, payload: Dict[str, object]) -> Deal:
        response = self._request("PATCH", f"/deals/{deal_id}", json=payload)
        return Deal.model_validate(response.json())

    def delete_deal(self, deal_id: UUID) -> None:
        payload = {
            "is_deleted": True,
        }
        self._request("PATCH", f"/deals/{deal_id}", json=payload)

    # ----- public API: policies ---------------------------------------------
    def create_policy(self, payload: Dict[str, object]) -> Policy:
        response = self._request("POST", "/policies", json=payload)
        return Policy.model_validate(response.json())

    def update_policy(self, policy_id: UUID, payload: Dict[str, object]) -> Policy:
        response = self._request("PATCH", f"/policies/{policy_id}", json=payload)
        return Policy.model_validate(response.json())

    def delete_policy(self, policy_id: UUID) -> None:
        payload = {
            "is_deleted": True,
        }
        self._request("PATCH", f"/policies/{policy_id}", json=payload)

    # ----- public API: tasks ------------------------------------------------
    def create_task(self, payload: Dict[str, object]) -> Task:
        response = self._request("POST", "/tasks", json=payload)
        return Task.model_validate(response.json())

    def update_task(self, task_id: UUID, payload: Dict[str, object]) -> Task:
        response = self._request("PATCH", f"/tasks/{task_id}", json=payload)
        return Task.model_validate(response.json())

    def delete_task(self, task_id: UUID) -> None:
        payload = {
            "status": "cancelled",
        }
        self._request("PATCH", f"/tasks/{task_id}", json=payload)

    # ----- public API: policies / payments / tasks -------------------------
    def fetch_policies(self) -> List[Policy]:
        data = self._get("/policies")
        return [Policy.model_validate(item) for item in data if not item.get("isDeleted")]

    def fetch_tasks(self) -> List[Task]:
        data = self._get("/tasks")
        return [Task.model_validate(item) for item in data if item.get("status") != "cancelled"]

    def fetch_payments(self, deal_id: UUID, policy_id: UUID) -> List[Payment]:
        path = f"/deals/{deal_id}/policies/{policy_id}/payments"
        data = self._get(path)
        if isinstance(data, dict):
            items: Sequence[dict] = data.get("items", [])  # type: ignore[assignment]
        else:
            items = data  # pragma: no cover - fallback for alternative schemas
        filtered_items = [
            item for item in items if not isinstance(item, dict) or not item.get("isDeleted")
        ]
        return [Payment.model_validate(item) for item in filtered_items]

    def create_payment(self, deal_id: UUID, policy_id: UUID, payload: Dict[str, object]) -> Payment:
        path = f"/deals/{deal_id}/policies/{policy_id}/payments"
        response = self._request("POST", path, json=payload)
        return Payment.model_validate(response.json())

    def update_payment(
        self,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        payload: Dict[str, object],
    ) -> Payment:
        path = f"/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}"
        response = self._request("PATCH", path, json=payload)
        return Payment.model_validate(response.json())

    def delete_payment(self, deal_id: UUID, policy_id: UUID, payment_id: UUID) -> None:
        path = f"/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}"
        self._request("DELETE", path)

    def fetch_payments_for_policies(self, policies: Iterable[Policy]) -> List[Payment]:
        payments: list[Payment] = []
        for policy in policies:
            if not policy.deal_id:
                continue
            try:
                payments.extend(self.fetch_payments(policy.deal_id, policy.id))
            except APIClientError:
                continue
        return payments

    # ----- derived stats ---------------------------------------------------
    def fetch_stats(self) -> StatCounters:
        clients = self.fetch_clients()
        deals = self.fetch_deals()
        policies = self.fetch_policies()
        tasks = self.fetch_tasks()
        return StatCounters(
            clients=len(clients),
            deals=len(deals),
            policies=len(policies),
            tasks=len(tasks),
        )

    # ----- context manager --------------------------------------------------
    def __enter__(self) -> "APIClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # pragma: no cover
        self.close()
