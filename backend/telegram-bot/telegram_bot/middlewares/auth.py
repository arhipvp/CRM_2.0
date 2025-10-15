from __future__ import annotations

from typing import Any

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, Update

from telegram_bot.clients.auth import AuthClient, AuthClientError, AuthUserNotFound


class AuthMiddleware(BaseMiddleware):
    """Middleware, проверяющее право пользователя на выполнение команд."""

    def __init__(self, auth_client: AuthClient) -> None:
        super().__init__()
        self._auth = auth_client

    async def __call__(self, handler: Handler, event: Update, data: dict[str, Any]) -> Any:
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


def _extract_user_id(event: Update) -> int | None:
    message = event.message or event.edited_message or event.callback_query
    if isinstance(message, Message) and message.from_user:
        return message.from_user.id
    if isinstance(message, CallbackQuery) and message.from_user:
        return message.from_user.id
    return None


async def _reply_forbidden(event: Update) -> None:
    if event.message:
        await event.message.answer("Не удалось найти связанную учётную запись. Обратитесь к администратору.")
    elif event.callback_query:
        await event.callback_query.answer(
            "Нет доступа. Проверьте привязку Telegram в профиле CRM.", show_alert=True
        )


async def _reply_service_unavailable(event: Update) -> None:
    if event.message:
        await event.message.answer("Auth временно недоступен. Попробуйте позже.")
    elif event.callback_query:
        await event.callback_query.answer("Auth временно недоступен", show_alert=True)
