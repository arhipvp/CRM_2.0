from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from crm.app.dependencies import get_notification_template_service
from crm.domain import schemas, services

router = APIRouter(prefix="/templates", tags=["notification-templates"])


@router.get("", response_model=list[schemas.NotificationTemplateRead])
async def list_templates(
    channel: schemas.NotificationTemplateChannel | None = Query(default=None),
    active: bool | None = Query(default=None),
    service: services.NotificationTemplateService = Depends(get_notification_template_service),
) -> list[schemas.NotificationTemplateRead]:
    filters = schemas.NotificationTemplateListFilters(channel=channel, active=active)
    templates = await service.list_templates(filters)
    return list(templates)


@router.post("", response_model=schemas.NotificationTemplateRead, status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: schemas.NotificationTemplateCreate,
    service: services.NotificationTemplateService = Depends(get_notification_template_service),
) -> schemas.NotificationTemplateRead:
    try:
        return await service.create_template(payload)
    except services.NotificationTemplateConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="template_conflict",
        ) from exc
