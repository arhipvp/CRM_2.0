from __future__ import annotations

from typing import Iterable, List, Sequence
from uuid import UUID

import httpx

from models import (
    Client,
    Deal,
    Payment,
    Policy,
    StatCounters,
    Task,
)


class APIClientError(RuntimeError):
    """Raised when the CRM API request fails."""


class APIClient:
    def __init__(self, base_url: str, timeout: float = 10.0) -> None:
        self._client = httpx.Client(base_url=base_url, timeout=timeout)

    def close(self) -> None:
        self._client.close()

    # ----- internal helpers -------------------------------------------------
    def _get(self, url: str, params: dict | None = None) -> dict | list:
        try:
            response = self._client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:  # pragma: no cover - network errors
            raise APIClientError(str(exc)) from exc

    # ----- public API -------------------------------------------------------
    def fetch_clients(self) -> List[Client]:
        data = self._get("/clients")
        return [Client.model_validate(item) for item in data]  # type: ignore[arg-type]

    def fetch_deals(self) -> List[Deal]:
        data = self._get("/deals")
        return [Deal.model_validate(item) for item in data]  # type: ignore[arg-type]

    def fetch_policies(self) -> List[Policy]:
        data = self._get("/policies")
        return [Policy.model_validate(item) for item in data]  # type: ignore[arg-type]

    def fetch_tasks(self) -> List[Task]:
        data = self._get("/tasks")
        return [Task.model_validate(item) for item in data]  # type: ignore[arg-type]

    def fetch_payments(self, deal_id: UUID, policy_id: UUID) -> List[Payment]:
        path = f"/deals/{deal_id}/policies/{policy_id}/payments"
        data = self._get(path)
        if isinstance(data, dict):
            items: Sequence[dict] = data.get("items", [])  # type: ignore[assignment]
        else:
            items = data  # pragma: no cover - fallback for alternative schemas
        return [Payment.model_validate(item) for item in items]

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

    def fetch_stats(self) -> StatCounters:
        """Derived counters using existing endpoints."""
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

