from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from crm.app.dependencies import get_permissions_service
from crm.domain import schemas
from crm.domain.services import PermissionSyncError, PermissionSyncService

router = APIRouter(prefix="/permissions", tags=["permissions"])


@router.post("/sync", response_model=schemas.SyncPermissionsResponse, status_code=status.HTTP_202_ACCEPTED)
async def sync_permissions(
    payload: schemas.SyncPermissionsDto,
    service: Annotated[PermissionSyncService, Depends(get_permissions_service)],
) -> schemas.SyncPermissionsResponse:
    try:
        return await service.sync_permissions(payload)
    except PermissionSyncError as exc:  # pragma: no cover - error handling
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="queue_unavailable") from exc
