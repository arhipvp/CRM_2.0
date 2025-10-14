from datetime import date
from typing import Annotated, Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from crm.app.dependencies import get_calculation_service, get_tenant_id
from crm.domain import schemas
from crm.domain.services import CalculationService
from crm.infrastructure.repositories import RepositoryError

router = APIRouter(prefix="/deals/{deal_id}/calculations", tags=["calculations"])


@router.get("/", response_model=list[schemas.CalculationRead])
async def list_calculations(
    deal_id: UUID,
    *,
    status_filter: Sequence[str] | None = Query(default=None, alias="status[]"),
    insurance_company: str | None = Query(default=None, min_length=1),
    calculation_date_from: date | None = Query(default=None),
    calculation_date_to: date | None = Query(default=None),
    service: Annotated[CalculationService, Depends(get_calculation_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> list[schemas.CalculationRead]:
    return list(
        await service.list_calculations(
            tenant_id,
            deal_id,
            statuses=status_filter,
            insurance_company=insurance_company,
            date_from=calculation_date_from,
            date_to=calculation_date_to,
        )
    )


@router.post("/", response_model=schemas.CalculationRead, status_code=status.HTTP_201_CREATED)
async def create_calculation(
    deal_id: UUID,
    payload: schemas.CalculationCreate,
    service: Annotated[CalculationService, Depends(get_calculation_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> schemas.CalculationRead:
    return await service.create_calculation(tenant_id, deal_id, payload)


@router.get("/{calculation_id}", response_model=schemas.CalculationRead)
async def get_calculation(
    deal_id: UUID,
    calculation_id: UUID,
    service: Annotated[CalculationService, Depends(get_calculation_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> schemas.CalculationRead:
    calculation = await service.get_calculation(tenant_id, deal_id, calculation_id)
    if calculation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="calculation_not_found")
    return calculation


@router.patch("/{calculation_id}", response_model=schemas.CalculationRead)
async def update_calculation(
    deal_id: UUID,
    calculation_id: UUID,
    payload: schemas.CalculationUpdate,
    service: Annotated[CalculationService, Depends(get_calculation_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> schemas.CalculationRead:
    calculation = await service.update_calculation(tenant_id, deal_id, calculation_id, payload)
    if calculation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="calculation_not_found")
    return calculation


@router.post("/{calculation_id}/status", response_model=schemas.CalculationRead)
async def change_calculation_status(
    deal_id: UUID,
    calculation_id: UUID,
    payload: schemas.CalculationStatusChange,
    service: Annotated[CalculationService, Depends(get_calculation_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> schemas.CalculationRead:
    try:
        calculation = await service.change_status(tenant_id, deal_id, calculation_id, payload)
    except RepositoryError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if calculation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="calculation_not_found")
    return calculation


@router.delete("/{calculation_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_calculation(
    deal_id: UUID,
    calculation_id: UUID,
    service: Annotated[CalculationService, Depends(get_calculation_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> Response:
    deleted = await service.delete_calculation(tenant_id, deal_id, calculation_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="calculation_not_found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
