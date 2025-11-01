from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Sequence
from uuid import UUID

import httpx

from models import Client, Deal, Payment, Policy, StatCounters, Task


class APIClientError(RuntimeError):
    """Raised when the CRM API request fails."""


class APIClient:
    def __init__(self, base_url: str, timeout: float = 10.0) -> None:
        self._client = httpx.Client(base_url=base_url, timeout=timeout)

    def close(self) -> None:
        self._client.close()

    # ----- internal helpers -------------------------------------------------
    def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        try:
            response = self._client.request(method, url, **kwargs)
            response.raise_for_status()
            return response
        except httpx.HTTPError as exc:  # pragma: no cover - network errors
            raise APIClientError(str(exc)) from exc

    def _get(self, url: str, params: dict | None = None) -> dict | list:
        return self._request("GET", url, params=params).json()

    # ----- public API: clients ---------------------------------------------
    def fetch_clients(self) -> List[Client]:
        data = self._get("/clients")
        return [Client.model_validate(item) for item in data]  # type: ignore[arg-type]

    def create_client(self, payload: Dict[str, Optional[str]]) -> Client:
        response = self._request("POST", "/clients", json=payload)
        return Client.model_validate(response.json())

    def update_client(self, client_id: UUID, payload: Dict[str, Optional[str]]) -> Client:
        response = self._request("PATCH", f"/clients/{client_id}", json=payload)
        return Client.model_validate(response.json())

    def delete_client(self, client_id: UUID) -> None:
        self._request("DELETE", f"/clients/{client_id}")

    # ----- public API: deals -----------------------------------------------
    def fetch_deals(self) -> List[Deal]:
        data = self._get("/deals")
        return [Deal.model_validate(item) for item in data]  # type: ignore[arg-type]

    def create_deal(self, payload: Dict[str, object]) -> Deal:
        response = self._request("POST", "/deals", json=payload)
        return Deal.model_validate(response.json())

    def update_deal(self, deal_id: UUID, payload: Dict[str, object]) -> Deal:
        response = self._request("PATCH", f"/deals/{deal_id}", json=payload)
        return Deal.model_validate(response.json())

    def delete_deal(self, deal_id: UUID) -> None:
        self._request("DELETE", f"/deals/{deal_id}")

    # ----- public API: policies / payments / tasks -------------------------
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

