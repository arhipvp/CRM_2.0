from __future__ import annotations

from typing import Annotated, AsyncIterator
from uuid import UUID

import jwt
from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from jwt import InvalidTokenError
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from redis.asyncio import Redis

from crm.app.config import settings
from crm.domain import services
from crm.infrastructure import repositories
from crm.app.events import EventsPublisher
from crm.infrastructure.notifications import NotificationDispatcher
from crm.infrastructure.queues import DelayedTaskQueue, PermissionsQueue, TaskReminderQueue
from crm.infrastructure.db import AsyncSessionFactory
from crm.infrastructure.task_events import TaskEventsPublisher


AuthorizationHeader = Annotated[str | None, Header(alias="Authorization")]
AccessTokenCookie = Annotated[str | None, Cookie(alias="crm_access_token")]


class AuthenticatedUser(BaseModel):
    id: UUID
    email: str
    roles: list[str]


def _decode_authorization_header(authorization: str | None) -> str | None:
    if not authorization:
        return None

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_authorization_header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token.strip()


def _resolve_token(
    authorization: AuthorizationHeader = None,
    access_token_cookie: AccessTokenCookie = None,
) -> str:
    token: str | None = None

    if authorization:
        try:
            token = _decode_authorization_header(authorization)
        except HTTPException:
            if access_token_cookie:
                return access_token_cookie.strip()
            raise

    if token:
        return token

    if access_token_cookie:
        return access_token_cookie.strip()

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="authorization_required",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    authorization: AuthorizationHeader = None,
    access_token_cookie: AccessTokenCookie = None,
) -> AuthenticatedUser:
    # If auth is disabled, return a mock admin user
    if getattr(settings, "auth_disabled", False):
        return AuthenticatedUser(
            id=UUID("00000000-0000-0000-0000-000000000001"),
            email="admin@local.dev",
            roles=["admin"],
        )

    token = _resolve_token(authorization, access_token_cookie)

    options: dict[str, bool] = {"verify_signature": True, "verify_exp": True}
    if settings.jwt_audience:
        options["verify_aud"] = True
    else:
        options["verify_aud"] = False
    if settings.jwt_issuer:
        options["verify_iss"] = True
    else:
        options["verify_iss"] = False

    try:
        payload = jwt.decode(
            token,
            settings.jwt_access_secret,
            algorithms=["HS256"],
            audience=settings.jwt_audience if settings.jwt_audience else None,
            issuer=settings.jwt_issuer if settings.jwt_issuer else None,
            options=options,
        )
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    subject = payload.get("sub")
    email = payload.get("email")
    roles_payload = payload.get("roles", [])

    try:
        user_id = UUID(str(subject))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_token_subject",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if not isinstance(email, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_token_email",
            headers={"WWW-Authenticate": "Bearer"},
        )

    roles: list[str] = []
    if isinstance(roles_payload, list):
        for role in roles_payload:
            if isinstance(role, str):
                roles.append(role)
            elif isinstance(role, bytes):
                try:
                    roles.append(role.decode("utf-8"))
                except UnicodeDecodeError:
                    continue

    return AuthenticatedUser(id=user_id, email=email, roles=roles)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionFactory() as session:
        yield session


async def get_client_service(session: AsyncSession = Depends(get_db_session)) -> services.ClientService:
    return services.ClientService(repositories.ClientRepository(session))


async def get_deal_service(session: AsyncSession = Depends(get_db_session)) -> services.DealService:
    return services.DealService(repositories.DealRepository(session))


async def get_deal_journal_service(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> services.DealJournalService:
    publisher = await get_events_publisher(request)
    repository = repositories.DealJournalRepository(session)
    return services.DealJournalService(repository, publisher)


async def get_policy_service(session: AsyncSession = Depends(get_db_session)) -> services.PolicyService:
    policy_repository = repositories.PolicyRepository(session)
    return services.PolicyService(policy_repository)


async def get_calculation_service(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> services.CalculationService:
    publisher = await get_events_publisher(request)
    calculation_repository = repositories.CalculationRepository(session)
    policy_repository = repositories.PolicyRepository(session)
    policy_service = services.PolicyService(policy_repository)
    return services.CalculationService(
        calculation_repository,
        policy_repository,
        publisher,
        policy_service=policy_service,
    )


_task_queue_redis: Redis | None = None
_task_reminder_queue: TaskReminderQueue | None = None
_task_delayed_queue: DelayedTaskQueue | None = None

_notifications_redis: Redis | None = None
_notification_dispatcher: NotificationDispatcher | None = None
_notification_stream: services.NotificationStreamService | None = None
_telegram_service: services.TelegramService | None = None


def _get_task_queue_redis() -> Redis:
    global _task_queue_redis
    if _task_queue_redis is None:
        _task_queue_redis = Redis.from_url(
            settings.redis_url, encoding="utf-8", decode_responses=True
        )
    return _task_queue_redis


def get_task_reminder_queue() -> TaskReminderQueue:
    global _task_reminder_queue
    if _task_reminder_queue is None:
        redis = _get_task_queue_redis()
        _task_reminder_queue = TaskReminderQueue(
            redis=redis,
            queue_key=settings.tasks_reminders_queue_key,
        )
    return _task_reminder_queue


def get_delayed_task_queue() -> DelayedTaskQueue:
    global _task_delayed_queue
    if _task_delayed_queue is None:
        redis = _get_task_queue_redis()
        _task_delayed_queue = DelayedTaskQueue(
            redis=redis,
            queue_key=settings.tasks_delayed_queue_key,
        )
    return _task_delayed_queue


async def close_task_queues() -> None:
    global _task_queue_redis, _task_reminder_queue, _task_delayed_queue
    _task_reminder_queue = None
    _task_delayed_queue = None
    if _task_queue_redis is not None:
        await _task_queue_redis.aclose()
        _task_queue_redis = None


def _get_notifications_redis() -> Redis:
    global _notifications_redis
    if _notifications_redis is None:
        _notifications_redis = Redis.from_url(
            settings.redis_url, encoding="utf-8", decode_responses=True
        )
    return _notifications_redis


def get_notification_dispatcher() -> NotificationDispatcher:
    global _notification_dispatcher
    if _notification_dispatcher is None:
        redis = _get_notifications_redis()
        _notification_dispatcher = NotificationDispatcher(settings, redis)
    return _notification_dispatcher


def get_notification_stream() -> services.NotificationStreamService:
    global _notification_stream
    if _notification_stream is None:
        _notification_stream = services.NotificationStreamService(
            settings.notifications_sse_retry_ms
        )
    return _notification_stream


def get_telegram_service() -> services.TelegramService:
    global _telegram_service
    if _telegram_service is None:
        _telegram_service = services.TelegramService(
            enabled=settings.notifications_telegram_enabled,
            mock=settings.notifications_telegram_mock,
            bot_token=settings.notifications_telegram_bot_token,
            default_chat_id=settings.notifications_telegram_default_chat_id,
        )
    return _telegram_service


async def close_notification_dependencies() -> None:
    global _notification_dispatcher, _notifications_redis, _notification_stream
    dispatcher = _notification_dispatcher
    _notification_dispatcher = None
    if dispatcher is not None:
        await dispatcher.close()
    if _notifications_redis is not None:
        await _notifications_redis.aclose()
        _notifications_redis = None
    _notification_stream = None


def _build_notification_events_service(
    session: AsyncSession,
) -> services.NotificationEventsService:
    stream = get_notification_stream()
    telegram = get_telegram_service()
    repository = repositories.NotificationEventRepository(session)
    return services.NotificationEventsService(repository, stream, telegram)


async def get_notification_template_service(
    session: AsyncSession = Depends(get_db_session),
) -> services.NotificationTemplateService:
    repository = repositories.NotificationTemplateRepository(session)
    return services.NotificationTemplateService(
        repository,
        settings.notifications_templates_default_locale,
    )


async def get_notification_events_service(
    session: AsyncSession = Depends(get_db_session),
) -> services.NotificationEventsService:
    return _build_notification_events_service(session)


async def get_notification_service(
    session: AsyncSession = Depends(get_db_session),
) -> services.NotificationService:
    repository = repositories.NotificationRepository(session)
    attempts = repositories.NotificationAttemptRepository(session)
    events_repository = repositories.NotificationEventRepository(session)
    dispatcher = get_notification_dispatcher()
    events_service = _build_notification_events_service(session)
    return services.NotificationService(
        repository,
        attempts,
        events_repository,
        dispatcher,
        events_service,
        rabbit_exchange=settings.notifications_dispatch_exchange,
        rabbit_routing_key=settings.notifications_dispatch_routing_key,
        redis_channel=settings.notifications_dispatch_redis_channel,
        retry_attempts=settings.notifications_dispatch_retry_attempts,
        retry_delay_ms=settings.notifications_dispatch_retry_delay_ms,
    )


class _NullTaskEventsPublisher:
    async def task_created(self, task: object) -> None:  # pragma: no cover - noop
        return None

    async def task_status_changed(self, task: object, previous_status: object) -> None:  # pragma: no cover - noop
        return None

    async def task_reminder(self, reminder: object) -> None:  # pragma: no cover - noop
        return None


async def get_task_events_publisher(
    request: Request,
) -> TaskEventsPublisher | _NullTaskEventsPublisher:
    publisher = getattr(request.app.state, "task_events_publisher", None)
    if isinstance(publisher, TaskEventsPublisher):
        return publisher
    return _NullTaskEventsPublisher()


async def get_task_service(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> services.TaskService:
    repository = repositories.TaskRepository(session)
    status_repository = repositories.TaskStatusRepository(session)
    reminder_repository = repositories.TaskReminderRepository(session)
    delayed_queue = get_delayed_task_queue()
    reminder_queue = get_task_reminder_queue()
    events = await get_task_events_publisher(request)
    return services.TaskService(
        repository,
        status_repository,
        reminder_repository,
        delayed_queue,
        reminder_queue,
        events,
    )


class _NullEventsPublisher:
    async def publish(self, routing_key: str, payload: dict[str, object]) -> None:  # pragma: no cover - noop
        return None


async def get_events_publisher(request: Request) -> EventsPublisher | _NullEventsPublisher:
    publisher = getattr(request.app.state, "events_publisher", None)
    if isinstance(publisher, EventsPublisher):
        return publisher
    return _NullEventsPublisher()


async def get_payment_service(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> services.PaymentService:
    publisher = await get_events_publisher(request)
    payments_repository = repositories.PaymentRepository(session)
    incomes_repository = repositories.PaymentIncomeRepository(session)
    expenses_repository = repositories.PaymentExpenseRepository(session)
    return services.PaymentService(
        payments_repository,
        incomes_repository,
        expenses_repository,
        publisher,
    )


_permissions_queue: PermissionsQueue | None = None


def get_permissions_queue() -> PermissionsQueue:
    global _permissions_queue
    if _permissions_queue is None:
        redis = Redis.from_url(settings.resolved_permissions_redis, encoding="utf-8", decode_responses=True)
        _permissions_queue = PermissionsQueue(
            redis=redis,
            queue_name=settings.permissions_queue_name,
            prefix=settings.permissions_queue_prefix,
            job_name=settings.permissions_job_name,
        )
    return _permissions_queue


async def close_permissions_queue() -> None:
    global _permissions_queue
    if _permissions_queue is not None:
        await _permissions_queue.close()
        _permissions_queue = None


async def get_permissions_service(
    session: AsyncSession = Depends(get_db_session),
) -> services.PermissionSyncService:
    queue = get_permissions_queue()
    repository = repositories.PermissionSyncJobRepository(session)
    return services.PermissionSyncService(repository, queue, settings.permissions_queue_name)


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return AsyncSessionFactory
