from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any
from uuid import UUID

import httpx


class CRMClientError(RuntimeError):
    """Базовая ошибка клиента CRM."""


@dataclass(slots=True)
class Client:
    id: UUID
    name: str
    email: str | None
    phone: str | None


@dataclass(slots=True)
class Deal:
    id: UUID
    title: str
    status: str
    client_id: UUID
    next_review_at: date


@dataclass(slots=True)
class Task:
    id: UUID
    title: str
    status: str
    due_date: date | None
    description: str | None


class CRMClient:
    def __init__(self, http: httpx.AsyncClient, base_url: str, token: str) -> None:
        self._http = http
        self._base_url = base_url.rstrip("/")
        self._token = token

    def _headers(self, tenant_id: UUID) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token}",
            "X-Tenant-ID": str(tenant_id),
        }

    async def create_client(
        self,
        tenant_id: UUID,
        *,
        name: str,
        owner_id: UUID,
        email: str | None = None,
        phone: str | None = None,
    ) -> Client:
        payload = {
            "name": name,
            "owner_id": str(owner_id),
            "email": email,
            "phone": phone,
            "status": "active",
        }
        response = await self._http.post(
            f"{self._base_url}/clients",
            headers=self._headers(tenant_id),
            json=payload,
            timeout=10.0,
        )
        if response.status_code >= 500:
            raise CRMClientError("crm_unavailable")
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        return Client(
            id=UUID(data["id"]),
            name=data["name"],
            email=data.get("email"),
            phone=data.get("phone"),
        )

    async def create_deal(
        self,
        tenant_id: UUID,
        *,
        client_id: UUID,
        owner_id: UUID,
        title: str,
        description: str | None,
        next_review_at: date,
        value: float | None = None,
    ) -> Deal:
        payload = {
            "client_id": str(client_id),
            "owner_id": str(owner_id),
            "title": title,
            "description": description,
            "next_review_at": next_review_at.isoformat(),
            "value": value,
            "status": "draft",
        }
        response = await self._http.post(
            f"{self._base_url}/deals",
            headers=self._headers(tenant_id),
            json=payload,
            timeout=10.0,
        )
        if response.status_code >= 500:
            raise CRMClientError("crm_unavailable")
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        return Deal(
            id=UUID(data["id"]),
            title=data["title"],
            status=data["status"],
            client_id=UUID(data["client_id"]),
            next_review_at=date.fromisoformat(data["next_review_at"]),
        )

    async def get_task(self, tenant_id: UUID, task_id: UUID) -> Task:
        response = await self._http.get(
            f"{self._base_url}/tasks/{task_id}",
            headers=self._headers(tenant_id),
            timeout=10.0,
        )
        if response.status_code == httpx.codes.NOT_FOUND:
            raise CRMClientError("task_not_found")
        if response.status_code >= 500:
            raise CRMClientError("crm_unavailable")
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        due_date = data.get("due_date")
        return Task(
            id=UUID(data["id"]),
            title=data["title"],
            status=data["status"],
            due_date=date.fromisoformat(due_date) if due_date else None,
            description=data.get("description"),
        )

    async def update_task_status(
        self, tenant_id: UUID, task_id: UUID, *, status: str, description: str | None = None
    ) -> None:
        payload = {"status": status, "description": description}
        response = await self._http.patch(
            f"{self._base_url}/tasks/{task_id}",
            headers=self._headers(tenant_id),
            json=payload,
            timeout=10.0,
        )
        if response.status_code == httpx.codes.NOT_FOUND:
            raise CRMClientError("task_not_found")
        if response.status_code >= 500:
            raise CRMClientError("crm_unavailable")
        response.raise_for_status()

    async def update_payment(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        *,
        status: str,
        actual_date: date,
        recorded_by_id: UUID,
    ) -> None:
        payload = {
            "status": status,
            "actual_date": actual_date.isoformat(),
            "recorded_by_id": str(recorded_by_id),
        }
        response = await self._http.patch(
            f"{self._base_url}/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}",
            headers=self._headers(tenant_id),
            json=payload,
            timeout=10.0,
        )
        if response.status_code == httpx.codes.NOT_FOUND:
            raise CRMClientError("payment_not_found")
        if response.status_code >= 500:
            raise CRMClientError("crm_unavailable")
        response.raise_for_status()
