from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from crm.app.dependencies import get_notification_service
from crm.domain import schemas, services

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/", status_code=status.HTTP_202_ACCEPTED)
async def enqueue_notification(
    payload: schemas.NotificationCreate,
    service: services.NotificationService = Depends(get_notification_service),
) -> dict[str, str]:
    try:
        notification = await service.enqueue(payload)
    except services.DuplicateNotificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="duplicate_notification",
        ) from exc
    except services.NotificationDispatchError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="notification_dispatch_failed",
        ) from exc
    return {"notification_id": str(notification.id)}

router.add_api_route(
    "",
    enqueue_notification,
    methods=["POST"],
    status_code=status.HTTP_202_ACCEPTED,
    include_in_schema=False,
)

@router.get("/{notification_id}", response_model=schemas.NotificationStatusResponse)
async def get_notification_status(
    notification_id: UUID,
    service: services.NotificationService = Depends(get_notification_service),
) -> schemas.NotificationStatusResponse:
    status_response = await service.get_status(notification_id)
    if status_response is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="notification_not_found",
        )
    return status_response
