from __future__ import annotations

import hashlib
import hmac
import json
import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable
from uuid import UUID

import httpx
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.client.telegram import TelegramAPIServer
from aiogram.enums import ParseMode
from aiogram.fsm.storage.redis import RedisStorage
from fastapi import FastAPI, Header, HTTPException, Request, Response, status
from redis.asyncio import Redis

from telegram_bot import handlers
from telegram_bot.clients.auth import AuthClient, AuthClientError, AuthUserNotFound
from telegram_bot.clients.crm import CRMClient
from telegram_bot.clients.notifications import NotificationsClient
from telegram_bot.config import Settings, get_settings
from telegram_bot.events.consumer import NotificationsConsumer
from telegram_bot.events.publisher import IntegrationEventPublisher
from telegram_bot.middlewares.auth import AuthMiddleware
from telegram_bot.services.deals import DealService
from telegram_bot.services.payments import PaymentService
from telegram_bot.services.tasks import TaskService

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ApplicationState:
    settings: Settings
    http_client: httpx.AsyncClient
    redis: Redis
    bot: Bot
    dispatcher: Dispatcher
    publisher: IntegrationEventPublisher
    notifications_consumer: NotificationsConsumer
    auth_client: AuthClient
    crm_client: CRMClient
    notifications_client: NotificationsClient
    deal_service: DealService
    task_service: TaskService
    payment_service: PaymentService


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="CRM Telegram Bot", version="0.1.0")

    bot = _create_bot(settings)
    redis = Redis.from_url(str(settings.redis_url), encoding="utf-8", decode_responses=True)
    storage = RedisStorage(redis)
    dispatcher = Dispatcher(storage=storage)

    http_client = httpx.AsyncClient()
    auth_client = AuthClient(http_client, str(settings.auth_base_url), settings.auth_service_token)
    crm_client = CRMClient(http_client, str(settings.crm_base_url), settings.crm_service_token)
    notifications_client = NotificationsClient(
        http_client, str(settings.notifications_base_url), settings.notifications_service_token
    )
    publisher = IntegrationEventPublisher(str(settings.rabbitmq_url), settings.event_source)

    deal_service = DealService(
        crm_client,
        notifications_client,
        publisher,
        exchange_crm=settings.rabbitmq_exchange_crm,
    )
    task_service = TaskService(
        crm_client,
        notifications_client,
        publisher,
        exchange_tasks=settings.rabbitmq_exchange_tasks,
    )
    payment_service = PaymentService(
        crm_client,
        notifications_client,
        publisher,
        exchange_crm=settings.rabbitmq_exchange_crm,
    )

    dispatcher.workflow_data.update(
        {
            "deal_service": deal_service,
            "task_service": task_service,
            "payment_service": payment_service,
        }
    )
    auth_middleware = AuthMiddleware(auth_client)
    dispatcher.message.middleware(auth_middleware)
    dispatcher.callback_query.middleware(auth_middleware)
    dispatcher.include_router(handlers.create_router())

    notifications_consumer = NotificationsConsumer(
        str(settings.rabbitmq_url),
        settings.rabbitmq_exchange_notifications,
        settings.rabbitmq_queue_notifications,
    )

    app.state.application = ApplicationState(
        settings=settings,
        http_client=http_client,
        redis=redis,
        bot=bot,
        dispatcher=dispatcher,
        publisher=publisher,
        notifications_consumer=notifications_consumer,
        auth_client=auth_client,
        crm_client=crm_client,
        notifications_client=notifications_client,
        deal_service=deal_service,
        task_service=task_service,
        payment_service=payment_service,
    )

    @app.on_event("startup")
    async def _startup() -> None:
        await notifications_consumer.start(_create_notification_handler(app.state.application))
        logger.info("Telegram Bot started with environment %s", settings.environment)

    @app.on_event("shutdown")
    async def _shutdown() -> None:
        await notifications_consumer.stop()
        await publisher.close()
        await http_client.aclose()
        await redis.close()
        await bot.session.close()

    @app.post(settings.webhook_path)
    async def telegram_webhook(
        request: Request,
        x_telegram_signature: str = Header(default=""),
    ) -> Response:
        body = await request.body()
        if not _verify_signature(body, settings.webhook_secret, x_telegram_signature):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_signature")
        update = json.loads(body.decode("utf-8"))
        await dispatcher.feed_raw_update(bot, update)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.get("/health")
    async def health(check_token: str = Header(alias="X-Health-Token")) -> dict[str, str]:
        if check_token != settings.healthcheck_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")
        return {"status": "ok"}

    return app


def _create_bot(settings: Settings) -> Bot:
    properties = DefaultBotProperties(parse_mode=ParseMode.HTML)
    if settings.bot_api_base:
        server = TelegramAPIServer.from_base(settings.bot_api_base)
        return Bot(token=settings.bot_token, default=properties, server=server)
    return Bot(token=settings.bot_token, default=properties)


def _verify_signature(body: bytes, secret: str, signature: str) -> bool:
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _create_notification_handler(state: ApplicationState) -> Callable[[dict[str, Any], dict[str, Any]], Awaitable[None]]:
    async def _handler(payload: dict[str, Any], headers: dict[str, Any]) -> None:
        event_type = payload.get("type")
        data = payload.get("data", {})
        trace_id = headers.get("X-Trace-Id")
        if event_type == "notifications.notification.dispatched":
            await _handle_notification_dispatched(state, data, trace_id)
        elif event_type == "notifications.notification.failed":
            logger.warning("Failed notification: %s", data)

    return _handler


async def _handle_notification_dispatched(
    state: ApplicationState, data: dict[str, Any], trace_id: str | None
) -> None:
    if "telegram" not in data.get("channels", []):
        return
    user_id = data.get("user_id")
    if not user_id:
        logger.warning("notification without user_id: %s", data)
        return
    try:
        binding = await state.auth_client.resolve_user_binding(UUID(user_id))
    except (ValueError, AuthUserNotFound, AuthClientError):
        logger.warning("Unable to resolve telegram binding for user %s", user_id)
        return
    message = _render_notification_message(data)
    await state.bot.send_message(chat_id=binding.telegram_id, text=message)
    logger.info("Notification %s delivered via bot", data.get("notification_id"), extra={"trace_id": trace_id})


def _render_notification_message(data: dict[str, Any]) -> str:
    template = data.get("template", "notification")
    notification_id = data.get("notification_id")
    created_at = data.get("created_at")
    return (
        f"Уведомление {template}\n"
        f"ID: {notification_id}\n"
        f"Создано: {created_at}"
    )
