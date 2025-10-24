from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError

from crm.app.dependencies import get_deal_service, get_tenant_id
from crm.domain import schemas
from crm.domain.services import DealService

router = APIRouter(prefix="/deals", tags=["deals"])


def _build_deal_filters(
    stage: str | None,
    managers: list[str] | None,
    period: str | None,
    search: str | None,
) -> schemas.DealFilters | None:
    data: dict[str, object] = {}

    if stage:
        data["stage"] = stage

    include_unassigned = False
    manager_values: list[UUID] = []
    if managers:
        for raw_value in managers:
            if raw_value == "__NO_MANAGER__":
                include_unassigned = True
                continue
            try:
                manager_values.append(UUID(raw_value))
            except ValueError as exc:  # pragma: no cover - validation layer handles errors
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="invalid_manager_id",
                ) from exc

    if manager_values:
        data["managers"] = manager_values
    if include_unassigned:
        data["include_unassigned"] = True

    if period and period != "all":
        data["period"] = period

    if search:
        stripped = search.strip()
        if stripped:
            data["search"] = stripped

    if not data:
        return None

    try:
        return schemas.DealFilters.model_validate(data)
    except ValidationError as exc:  # pragma: no cover - surface as HTTP 422
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="invalid_filters",
        ) from exc


@router.get("", response_model=list[schemas.DealRead])
async def list_deals(
    service: Annotated[DealService, Depends(get_deal_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    stage: Annotated[str | None, Query()] = None,
    manager: Annotated[list[str] | None, Query()] = None,
    period: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
) -> list[schemas.DealRead]:
    filters = _build_deal_filters(stage, manager, period, search)
    return list(await service.list_deals(tenant_id, filters))


@router.post("", response_model=schemas.DealRead, status_code=status.HTTP_201_CREATED)
async def create_deal(
    payload: schemas.DealCreate,
    service: Annotated[DealService, Depends(get_deal_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> schemas.DealRead:
    return await service.create_deal(tenant_id, payload)


@router.get("/stage-metrics", response_model=list[schemas.DealStageMetric])
async def get_stage_metrics(
    service: Annotated[DealService, Depends(get_deal_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    stage: Annotated[str | None, Query()] = None,
    manager: Annotated[list[str] | None, Query()] = None,
    period: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
) -> list[schemas.DealStageMetric]:
    filters = _build_deal_filters(stage, manager, period, search)
    return list(await service.get_stage_metrics(tenant_id, filters))


@router.get("/{deal_id}", response_model=schemas.DealRead)
async def get_deal(
    deal_id: UUID,
    service: Annotated[DealService, Depends(get_deal_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> schemas.DealRead:
    deal = await service.get_deal(tenant_id, deal_id)
    if deal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="deal_not_found")
    return deal


@router.patch("/{deal_id}", response_model=schemas.DealRead)
async def update_deal(
    deal_id: UUID,
    payload: schemas.DealUpdate,
    service: Annotated[DealService, Depends(get_deal_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> schemas.DealRead:
    deal = await service.update_deal(tenant_id, deal_id, payload)
    if deal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="deal_not_found")
    return deal


@router.patch("/{deal_id}/stage", response_model=schemas.DealRead)
async def update_deal_stage(
    deal_id: UUID,
    payload: schemas.DealStageUpdate,
    service: Annotated[DealService, Depends(get_deal_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> schemas.DealRead:
    deal = await service.update_stage(tenant_id, deal_id, payload.stage)
    if deal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="deal_not_found")
    return deal
