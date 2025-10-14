from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from crm.app.dependencies import get_payment_expense_service, get_tenant_id
from crm.domain import schemas
from crm.domain.services import PaymentExpenseService


router = APIRouter(
    prefix="/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/expenses",
    tags=["payment-expenses"],
)


@router.get("/", response_model=list[schemas.PaymentExpenseRead])
async def list_expenses(
    payment_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentExpenseService, Depends(get_payment_expense_service)],
) -> list[schemas.PaymentExpenseRead]:
    expenses = await service.list_expenses(tenant_id, payment_id)
    return list(expenses)


@router.get("/{expense_id}", response_model=schemas.PaymentExpenseRead)
async def get_expense(
    payment_id: UUID,
    expense_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentExpenseService, Depends(get_payment_expense_service)],
) -> schemas.PaymentExpenseRead:
    expense = await service.get_expense(tenant_id, payment_id, expense_id)
    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="expense_not_found")
    return expense


@router.post("/", response_model=schemas.PaymentExpenseRead, status_code=status.HTTP_201_CREATED)
async def create_expense(
    payment_id: UUID,
    payload: schemas.PaymentExpenseCreate,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentExpenseService, Depends(get_payment_expense_service)],
) -> schemas.PaymentExpenseRead:
    expense = await service.create_expense(tenant_id, payment_id, payload)
    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="payment_not_found")
    return expense


@router.patch("/{expense_id}", response_model=schemas.PaymentExpenseRead)
async def update_expense(
    payment_id: UUID,
    expense_id: UUID,
    payload: schemas.PaymentExpenseUpdate,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentExpenseService, Depends(get_payment_expense_service)],
) -> schemas.PaymentExpenseRead:
    expense = await service.update_expense(tenant_id, payment_id, expense_id, payload)
    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="expense_not_found")
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    payment_id: UUID,
    expense_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentExpenseService, Depends(get_payment_expense_service)],
) -> None:
    deleted = await service.delete_expense(tenant_id, payment_id, expense_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="expense_not_found")
