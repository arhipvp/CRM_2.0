from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from crm.app.dependencies import get_payment_service, get_tenant_id
from crm.domain import schemas
from crm.domain.services import PaymentService


router = APIRouter(prefix="/deals/{deal_id}/policies/{policy_id}/payments", tags=["payments"])


def _parse_includes(include: list[str]) -> tuple[bool, bool]:
    include_set = {item.lower() for item in include}
    return "incomes" in include_set, "expenses" in include_set


@router.get("/", response_model=list[schemas.PaymentRead])
async def list_payments(
    deal_id: UUID,
    policy_id: UUID,
    include: Annotated[list[str], Query(alias="include", default_factory=list)] = None,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentService, Depends(get_payment_service)] = None,
) -> list[schemas.PaymentRead]:
    include_incomes, include_expenses = _parse_includes(include or [])
    payments = await service.list_payments(
        tenant_id, deal_id, policy_id, include_incomes, include_expenses
    )
    return list(payments)


@router.post("/", response_model=schemas.PaymentRead, status_code=status.HTTP_201_CREATED)
async def create_payment(
    deal_id: UUID,
    policy_id: UUID,
    payload: schemas.PaymentCreate,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentService, Depends(get_payment_service)] = None,
) -> schemas.PaymentRead:
    if payload.deal_id != deal_id or payload.policy_id != policy_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_path_scope")
    return await service.create_payment(tenant_id, payload)


@router.get("/{payment_id}", response_model=schemas.PaymentRead)
async def get_payment(
    deal_id: UUID,
    policy_id: UUID,
    payment_id: UUID,
    include: Annotated[list[str], Query(alias="include", default_factory=list)] = None,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentService, Depends(get_payment_service)] = None,
) -> schemas.PaymentRead:
    include_incomes, include_expenses = _parse_includes(include or [])
    payment = await service.get_payment(
        tenant_id, deal_id, payment_id, include_incomes, include_expenses
    )
    if payment is None or payment.policy_id != policy_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="payment_not_found")
    return payment


@router.patch("/{payment_id}", response_model=schemas.PaymentRead)
async def update_payment(
    deal_id: UUID,
    policy_id: UUID,
    payment_id: UUID,
    payload: schemas.PaymentUpdate,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentService, Depends(get_payment_service)] = None,
) -> schemas.PaymentRead:
    payment = await service.update_payment(tenant_id, deal_id, payment_id, payload)
    if payment is None or payment.policy_id != policy_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="payment_not_found")
    return payment


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    deal_id: UUID,
    policy_id: UUID,
    payment_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    service: Annotated[PaymentService, Depends(get_payment_service)] = None,
) -> None:
    deleted = await service.delete_payment(tenant_id, deal_id, payment_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="payment_not_found")
