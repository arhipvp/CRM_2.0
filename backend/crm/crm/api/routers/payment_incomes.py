from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from crm.app.dependencies import get_payment_income_service, get_tenant_id
from crm.domain import schemas
from crm.domain.services import PaymentIncomeService


router = APIRouter(
    prefix="/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/incomes",
    tags=["payment-incomes"],
)


@router.get("/", response_model=list[schemas.PaymentIncomeRead])
async def list_incomes(
    payment_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentIncomeService, Depends(get_payment_income_service)],
) -> list[schemas.PaymentIncomeRead]:
    incomes = await service.list_incomes(tenant_id, payment_id)
    return list(incomes)


@router.get("/{income_id}", response_model=schemas.PaymentIncomeRead)
async def get_income(
    payment_id: UUID,
    income_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentIncomeService, Depends(get_payment_income_service)],
) -> schemas.PaymentIncomeRead:
    income = await service.get_income(tenant_id, payment_id, income_id)
    if income is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="income_not_found")
    return income


@router.post("/", response_model=schemas.PaymentIncomeRead, status_code=status.HTTP_201_CREATED)
async def create_income(
    payment_id: UUID,
    payload: schemas.PaymentIncomeCreate,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentIncomeService, Depends(get_payment_income_service)],
) -> schemas.PaymentIncomeRead:
    income = await service.create_income(tenant_id, payment_id, payload)
    if income is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="payment_not_found")
    return income


@router.patch("/{income_id}", response_model=schemas.PaymentIncomeRead)
async def update_income(
    payment_id: UUID,
    income_id: UUID,
    payload: schemas.PaymentIncomeUpdate,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentIncomeService, Depends(get_payment_income_service)],
) -> schemas.PaymentIncomeRead:
    income = await service.update_income(tenant_id, payment_id, income_id, payload)
    if income is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="income_not_found")
    return income


@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_income(
    payment_id: UUID,
    income_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentIncomeService, Depends(get_payment_income_service)],
) -> None:
    deleted = await service.delete_income(tenant_id, payment_id, income_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="income_not_found")
