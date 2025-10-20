from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from crm.app.dependencies import get_task_service, get_tenant_id
from crm.domain import schemas
from crm.domain.services import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[schemas.TaskRead])
async def list_tasks(
    service: Annotated[TaskService, Depends(get_task_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> list[schemas.TaskRead]:
    return list(await service.list_tasks(tenant_id))


@router.post("", response_model=schemas.TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: schemas.TaskCreate,
    service: Annotated[TaskService, Depends(get_task_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> schemas.TaskRead:
    return await service.create_task(tenant_id, payload)


@router.get("/{task_id}", response_model=schemas.TaskRead)
async def get_task(
    task_id: UUID,
    service: Annotated[TaskService, Depends(get_task_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> schemas.TaskRead:
    task = await service.get_task(tenant_id, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task_not_found")
    return task


@router.patch("/{task_id}", response_model=schemas.TaskRead)
async def update_task(
    task_id: UUID,
    payload: schemas.TaskUpdate,
    service: Annotated[TaskService, Depends(get_task_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> schemas.TaskRead:
    task = await service.update_task(tenant_id, task_id, payload)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task_not_found")
    return task
