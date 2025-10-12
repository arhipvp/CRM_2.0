from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from crm.app.dependencies import get_deal_service, get_tenant_id
from crm.domain import schemas
from crm.domain.services import DealService

router = APIRouter(prefix="/deals", tags=["deals"])


@router.get("/", response_model=list[schemas.DealRead])
async def list_deals(
    service: Annotated[DealService, Depends(get_deal_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> list[schemas.DealRead]:
    return list(await service.list_deals(tenant_id))


@router.post("/", response_model=schemas.DealRead, status_code=status.HTTP_201_CREATED)
async def create_deal(
    payload: schemas.DealCreate,
    service: Annotated[DealService, Depends(get_deal_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> schemas.DealRead:
    return await service.create_deal(tenant_id, payload)


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
