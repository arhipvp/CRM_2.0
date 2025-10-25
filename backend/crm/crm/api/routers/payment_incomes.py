from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from crm.app.dependencies import get_payment_service
from crm.domain import schemas
from crm.domain.services import PaymentService
from crm.infrastructure.repositories import RepositoryError

router = APIRouter(
    prefix="/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/incomes",
    tags=["payments"],
)


def _handle_repository_error(exc: RepositoryError) -> None:
    detail = str(exc)
    if detail == "policy_not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail) from exc
    if detail in {"currency_mismatch", "posted_at_in_future"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc


@router.post("", response_model=schemas.PaymentIncomeRead, status_code=status.HTTP_201_CREATED)
async def create_income(
    deal_id: UUID,
    policy_id: UUID,
    payment_id: UUID,
    payload: schemas.PaymentIncomeCreate,
    service: PaymentService = Depends(get_payment_service),
) -> schemas.PaymentIncomeRead:
    try:
        payment, income = await service.create_income(deal_id, policy_id, payment_id, payload)
    except RepositoryError as exc:
        _handle_repository_error(exc)
    if payment is None or income is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="payment_not_found")
    return income


@router.patch("/{income_id}", response_model=schemas.PaymentIncomeRead)
async def update_income(
    deal_id: UUID,
    policy_id: UUID,
    payment_id: UUID,
    income_id: UUID,
    payload: schemas.PaymentIncomeUpdate,
    service: PaymentService = Depends(get_payment_service),
) -> schemas.PaymentIncomeRead:
    try:
        payment, income = await service.update_income(
            deal_id, policy_id, payment_id, income_id, payload
        )
    except RepositoryError as exc:
        _handle_repository_error(exc)
    if payment is None or income is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="income_not_found")
    return income


@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_income(
    deal_id: UUID,
    policy_id: UUID,
    payment_id: UUID,
    income_id: UUID,
    service: PaymentService = Depends(get_payment_service),
    deleted_by_id: UUID | None = Query(default=None),
) -> Response:
    payment = await service.delete_income(
        deal_id,
        policy_id,
        payment_id,
        income_id,
        deleted_by_id=deleted_by_id,
    )
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="income_not_found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
