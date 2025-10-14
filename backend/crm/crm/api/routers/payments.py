from __future__ import annotations

from typing import Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from crm.app.dependencies import get_payment_service, get_tenant_id
from crm.domain import schemas
from crm.domain.services import PaymentService
from crm.infrastructure.repositories import RepositoryError

router = APIRouter(prefix="/deals/{deal_id}/policies/{policy_id}/payments", tags=["payments"])


@router.get("/", response_model=schemas.PaymentList)
async def list_payments(
    deal_id: UUID,
    policy_id: UUID,
    *,
    include: Sequence[str] | None = Query(default=None, alias="include[]"),
    status_filter: Sequence[str] | None = Query(default=None, alias="status[]"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    service: PaymentService = Depends(get_payment_service),
    tenant_id: UUID = Depends(get_tenant_id),
) -> schemas.PaymentList:
    return await service.list_payments(
        tenant_id,
        deal_id,
        policy_id,
        include=include,
        statuses=status_filter,
        limit=limit,
        offset=offset,
    )


@router.post("/", response_model=schemas.PaymentRead, status_code=status.HTTP_201_CREATED)
async def create_payment(
    deal_id: UUID,
    policy_id: UUID,
    payload: schemas.PaymentCreate,
    service: PaymentService = Depends(get_payment_service),
    tenant_id: UUID = Depends(get_tenant_id),
) -> schemas.PaymentRead:
    return await service.create_payment(tenant_id, deal_id, policy_id, payload)


@router.get("/{payment_id}", response_model=schemas.PaymentRead)
async def get_payment(
    deal_id: UUID,
    policy_id: UUID,
    payment_id: UUID,
    *,
    include: Sequence[str] | None = Query(default=None, alias="include[]"),
    service: PaymentService = Depends(get_payment_service),
    tenant_id: UUID = Depends(get_tenant_id),
) -> schemas.PaymentRead:
    payment = await service.get_payment(tenant_id, deal_id, policy_id, payment_id, include=include)
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="payment_not_found")
    return payment


@router.patch("/{payment_id}", response_model=schemas.PaymentRead)
async def update_payment(
    deal_id: UUID,
    policy_id: UUID,
    payment_id: UUID,
    payload: schemas.PaymentUpdate,
    service: PaymentService = Depends(get_payment_service),
    tenant_id: UUID = Depends(get_tenant_id),
) -> schemas.PaymentRead:
    try:
        payment = await service.update_payment(tenant_id, deal_id, policy_id, payment_id, payload)
    except RepositoryError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="payment_not_found")
    return payment


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_payment(
    deal_id: UUID,
    policy_id: UUID,
    payment_id: UUID,
    service: PaymentService = Depends(get_payment_service),
    tenant_id: UUID = Depends(get_tenant_id),
) -> Response:
    deleted = await service.delete_payment(tenant_id, deal_id, policy_id, payment_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="payment_not_found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
