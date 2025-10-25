from __future__ import annotations

import asyncio
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sse_starlette.sse import EventSourceResponse

from crm.app.dependencies import (
    AuthenticatedUser,
    get_current_user,
    get_notification_events_service,
    get_notification_stream,
)
from crm.domain import schemas, services

router = APIRouter(prefix="/notifications", tags=["notifications"])

HEARTBEAT_INTERVAL_SECONDS = 30.0


@router.post("/events", status_code=status.HTTP_202_ACCEPTED)
async def ingest_notification_event(
    payload: schemas.NotificationEventIngest,
    service: services.NotificationEventsService = Depends(get_notification_events_service),
) -> dict[str, str]:
    try:
        await service.handle_incoming(payload)
    except services.NotificationDispatchError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="notification_event_failed",
        ) from exc
    return {"status": "ok"}


@router.get("/health", include_in_schema=False)
async def notifications_healthcheck() -> dict[str, str]:
    return {"status": "ok"}


async def _stream_generator(
    request: Request,
    stream: services.NotificationStreamService,
) -> AsyncGenerator[dict[str, object], None]:
    queue = await stream.subscribe()
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                message = await asyncio.wait_for(
                    queue.get(), timeout=HEARTBEAT_INTERVAL_SECONDS
                )
            except asyncio.TimeoutError:
                yield {"event": "heartbeat", "data": ""}
                continue
            yield message
    finally:
        await stream.unsubscribe(queue)


@router.get("/stream", include_in_schema=False)
async def notifications_stream(
    request: Request,
    _: AuthenticatedUser = Depends(get_current_user),
    stream: services.NotificationStreamService = Depends(get_notification_stream),
) -> EventSourceResponse:
    generator = _stream_generator(request, stream)
    return EventSourceResponse(generator, ping=None)
