from __future__ import annotations

from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject

from telegram_bot.clients.auth import AuthClient, AuthClientError, AuthUserNotFound

Handler = Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]]


class AuthMiddleware(BaseMiddleware):
    """Middleware, проверяющее право пользователя на выполнение команд."""

    def __init__(self, auth_client: AuthClient) -> None:
        super().__init__()
        self._auth = auth_client

    async def __call__(self, handler: Handler, event: TelegramObject, data: dict[str, Any]) -> Any:
        telegram_id = _extract_user_id(event)
        if telegram_id is None:
            return await handler(event, data)
        try:
            user = await self._auth.resolve_telegram_user(telegram_id)
        except AuthUserNotFound:
            await _reply_forbidden(event)
            return None
        except AuthClientError:
            await _reply_service_unavailable(event)
            return None
        data["auth_user"] = user
        return await handler(event, data)


def _extract_user_id(event: TelegramObject) -> int | None:
    if isinstance(event, Message) and event.from_user:
        return event.from_user.id
    if isinstance(event, CallbackQuery) and event.from_user:
        return event.from_user.id
    return None


async def _reply_forbidden(event: TelegramObject) -> None:
    if isinstance(event, Message):
        await event.answer("Не удалось найти связанную учётную запись. Обратитесь к администратору.")
    elif isinstance(event, CallbackQuery):
        await event.answer("Нет доступа. Проверьте привязку Telegram в профиле CRM.", show_alert=True)


async def _reply_service_unavailable(event: TelegramObject) -> None:
    if isinstance(event, Message):
        await event.answer("Auth временно недоступен. Попробуйте позже.")
    elif isinstance(event, CallbackQuery):
        await event.answer("Auth временно недоступен", show_alert=True)
