from __future__ import annotations

from typing import Any
from uuid import UUID

import httpx


class NotificationsClientError(RuntimeError):
    """Ошибка при обращении к Notifications."""


class NotificationsClient:
    def __init__(self, http: httpx.AsyncClient, base_url: str, token: str) -> None:
        self._http = http
        self._base_url = base_url.rstrip("/")
        self._token = token

    async def send_event(
        self,
        *,
        event_key: str,
        user_id: UUID,
        payload: dict[str, Any],
        deduplication_key: str | None = None,
    ) -> UUID:
        body: dict[str, Any] = {
            "eventKey": event_key,
            "recipients": [{"userId": str(user_id)}],
            "payload": payload,
        }
        if deduplication_key:
            body["deduplicationKey"] = deduplication_key
        response = await self._http.post(
            f"{self._base_url}/notifications",
            headers={"Authorization": f"Bearer {self._token}"},
            json=body,
            timeout=5.0,
        )
        if response.status_code >= 500:
            raise NotificationsClientError("notifications_unavailable")
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        return UUID(data["notification_id"])
