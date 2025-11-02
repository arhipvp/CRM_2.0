from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import ValidationError

from crm.app.dependencies import get_task_service
from crm.domain import schemas
from crm.domain.services import TaskService, TaskServiceError

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _build_task_filters(
    assignee_id: UUID | None,
    statuses: list[str] | None,
    due_before: str | None,
    due_after: str | None,
    priorities: list[str] | None,
    limit: int,
    offset: int,
) -> schemas.TaskFilters | None:
    data: dict[str, Any] = {"limit": limit, "offset": offset}

    if assignee_id is not None:
        data["assignee_id"] = assignee_id
    if statuses:
        data["statuses"] = statuses
    if priorities:
        data["priorities"] = priorities
    if due_before is not None:
        data["due_before"] = due_before
    if due_after is not None:
        data["due_after"] = due_after

    if data == {"limit": limit, "offset": offset} and limit == 50 and offset == 0:
        return None

    try:
        return schemas.TaskFilters.model_validate(data)
    except ValidationError as exc:  # pragma: no cover - validation layer
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="invalid_filters",
        ) from exc


def _handle_task_error(exc: TaskServiceError) -> None:
    status_map = {
        "unknown_status": status.HTTP_400_BAD_REQUEST,
        "scheduled_for_required": status.HTTP_400_BAD_REQUEST,
        "invalid_status_transition": status.HTTP_409_CONFLICT,
        "cancelled_reason_required": status.HTTP_409_CONFLICT,
        "task_reminder_conflict": status.HTTP_409_CONFLICT,
    }
    http_status = status_map.get(exc.code, status.HTTP_400_BAD_REQUEST)
    detail: dict[str, Any] = {
        "statusCode": http_status,
        "code": exc.code,
        "message": str(exc),
    }
    if exc.details:
        detail["details"] = exc.details
    raise HTTPException(status_code=http_status, detail=detail)


@router.get("/", response_model=list[schemas.TaskRead])
async def list_tasks(
    service: Annotated[TaskService, Depends(get_task_service)],
    assignee_id: Annotated[UUID | None, Query(alias="assigneeId")] = None,
    status_param: Annotated[list[str] | None, Query(alias="status")] = None,
    due_before: Annotated[str | None, Query(alias="dueBefore")] = None,
    due_after: Annotated[str | None, Query(alias="dueAfter")] = None,
    priority_param: Annotated[list[str] | None, Query(alias="priority")] = None,
    limit: Annotated[int, Query(ge=1, le=200, alias="limit")] = 50,
    offset: Annotated[int, Query(ge=0, alias="offset")] = 0,
) -> list[schemas.TaskRead]:
    filters = _build_task_filters(
        assignee_id,
        status_param,
        due_before,
        due_after,
        priority_param,
        limit,
        offset,
    )
    tasks = await service.list_tasks(filters)
    return list(tasks)

router.add_api_route(
    "",
    list_tasks,
    methods=["GET"],
    response_model=list[schemas.TaskRead],
    include_in_schema=False,
)

@router.post("/", response_model=schemas.TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: schemas.TaskCreate,
    service: Annotated[TaskService, Depends(get_task_service)],
) -> schemas.TaskRead:
    try:
        return await service.create_task(payload)
    except TaskServiceError as exc:
        _handle_task_error(exc)

router.add_api_route(
    "",
    create_task,
    methods=["POST"],
    response_model=schemas.TaskRead,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)

@router.get("/{task_id}", response_model=schemas.TaskRead)
async def get_task(
    task_id: UUID,
    service: Annotated[TaskService, Depends(get_task_service)],
) -> schemas.TaskRead:
    task = await service.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task_not_found")
    return task


@router.patch("/{task_id}", response_model=schemas.TaskRead)
async def update_task(
    task_id: UUID,
    payload: schemas.TaskUpdate,
    service: Annotated[TaskService, Depends(get_task_service)],
) -> schemas.TaskRead:
    try:
        task = await service.update_task(task_id, payload)
    except TaskServiceError as exc:
        _handle_task_error(exc)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task_not_found")
    return task


@router.post("/{task_id}/schedule", response_model=schemas.TaskRead)
async def schedule_task(
    task_id: UUID,
    payload: schemas.TaskScheduleRequest,
    service: Annotated[TaskService, Depends(get_task_service)],
) -> schemas.TaskRead:
    try:
        task = await service.schedule_task(task_id, payload)
    except TaskServiceError as exc:
        _handle_task_error(exc)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task_not_found")
    return task


@router.post("/{task_id}/complete", response_model=schemas.TaskRead)
async def complete_task(
    task_id: UUID,
    service: Annotated[TaskService, Depends(get_task_service)],
    payload: schemas.TaskCompleteRequest = Body(default=schemas.TaskCompleteRequest()),
) -> schemas.TaskRead:
    try:
        task = await service.complete_task(task_id, payload)
    except TaskServiceError as exc:
        _handle_task_error(exc)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task_not_found")
    return task


@router.post(
    "/{task_id}/reminders",
    response_model=schemas.TaskReminderRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_task_reminder(
    task_id: UUID,
    payload: schemas.TaskReminderCreate,
    service: Annotated[TaskService, Depends(get_task_service)],
) -> schemas.TaskReminderRead:
    try:
        reminder = await service.create_reminder(task_id, payload)
    except TaskServiceError as exc:
        _handle_task_error(exc)
    if reminder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="task_not_found")
    return reminder
