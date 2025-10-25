from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

import httpx


class AuthClientError(RuntimeError):
    """Базовая ошибка Auth-клиента."""


class AuthUserNotFound(AuthClientError):
    """Пользователь не найден или не активирован."""


@dataclass(slots=True)
class AuthUser:
    id: UUID
    telegram_id: int
    roles: list[str]
    active: bool

    def ensure_active(self) -> "AuthUser":
        if not self.active:
            raise AuthUserNotFound("telegram_user_inactive")
        return self


class AuthClient:
    def __init__(self, http: httpx.AsyncClient, base_url: str, token: str) -> None:
        self._http = http
        self._base_url = base_url.rstrip("/")
        self._token = token

    async def resolve_telegram_user(self, telegram_id: int) -> AuthUser:
        url = f"{self._base_url}/internal/telegram/users/{telegram_id}"
        headers = {"Authorization": f"Bearer {self._token}"}
        response = await self._http.get(url, headers=headers, timeout=5.0)
        if response.status_code == httpx.codes.NOT_FOUND:
            raise AuthUserNotFound("telegram_user_not_found")
        if response.status_code == httpx.codes.UNAUTHORIZED:
            raise AuthClientError("unauthorized")
        if response.status_code >= 500:
            raise AuthClientError(f"auth_unavailable:{response.status_code}")
        response.raise_for_status()
        payload: dict[str, Any] = response.json()
        return AuthUser(
            id=UUID(payload["user_id"]),
            telegram_id=int(payload["telegram_id"]),
            roles=list(payload.get("roles", [])),
            active=bool(payload.get("active", True)),
        ).ensure_active()

    async def resolve_user_binding(self, user_id: UUID) -> AuthUser:
        url = f"{self._base_url}/internal/telegram/bindings/{user_id}"
        headers = {"Authorization": f"Bearer {self._token}"}
        response = await self._http.get(url, headers=headers, timeout=5.0)
        if response.status_code == httpx.codes.NOT_FOUND:
            raise AuthUserNotFound("telegram_binding_not_found")
        if response.status_code == httpx.codes.UNAUTHORIZED:
            raise AuthClientError("unauthorized")
        if response.status_code >= 500:
            raise AuthClientError(f"auth_unavailable:{response.status_code}")
        response.raise_for_status()
        payload: dict[str, Any] = response.json()
        return AuthUser(
            id=UUID(payload["user_id"]),
            telegram_id=int(payload["telegram_id"]),
            roles=list(payload.get("roles", [])),
            active=bool(payload.get("active", True)),
        ).ensure_active()
