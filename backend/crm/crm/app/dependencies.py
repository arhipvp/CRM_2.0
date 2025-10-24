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
from crm.infrastructure.queues import PermissionsQueue
from crm.infrastructure.db import AsyncSessionFactory


TenantHeader = Annotated[str | None, Header(alias="X-Tenant-ID")]
AuthorizationHeader = Annotated[str | None, Header(alias="Authorization")]
AccessTokenCookie = Annotated[str | None, Cookie(alias="crm_access_token")]


class AuthenticatedUser(BaseModel):
    id: UUID
    email: str
    roles: list[str]


async def get_tenant_id(header: TenantHeader = None) -> UUID:
    if header:
        try:
            return UUID(header)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid X-Tenant-ID header") from exc
    if settings.default_tenant_id:
        return UUID(settings.default_tenant_id)
    raise HTTPException(status_code=400, detail="Tenant scope is required")


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
    token = _decode_authorization_header(authorization)
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
        roles = [str(role) for role in roles_payload if isinstance(role, (str, bytes))]

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
    documents_repository = repositories.PolicyDocumentRepository(session)
    return services.PolicyService(policy_repository, documents_repository)


async def get_calculation_service(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> services.CalculationService:
    publisher = await get_events_publisher(request)
    calculation_repository = repositories.CalculationRepository(session)
    policy_repository = repositories.PolicyRepository(session)
    policy_documents_repository = repositories.PolicyDocumentRepository(session)
    policy_service = services.PolicyService(policy_repository, policy_documents_repository)
    return services.CalculationService(
        calculation_repository,
        policy_repository,
        publisher,
        policy_service=policy_service,
    )


async def get_task_service(session: AsyncSession = Depends(get_db_session)) -> services.TaskService:
    return services.TaskService(repositories.TaskRepository(session))


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
