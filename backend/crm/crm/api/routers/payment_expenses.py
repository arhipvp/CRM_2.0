from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from crm.app.dependencies import get_payment_service
from crm.domain import schemas
from crm.domain.services import PaymentService
from crm.infrastructure.repositories import RepositoryError

router = APIRouter(
    prefix="/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/expenses",
    tags=["payments"],
)


def _handle_repository_error(exc: RepositoryError) -> None:
    detail = str(exc)
    if detail == "policy_not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail) from exc
    if detail in {"currency_mismatch", "posted_at_in_future"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc


@router.post("/", response_model=schemas.PaymentExpenseRead, status_code=status.HTTP_201_CREATED)
async def create_expense(
    deal_id: UUID,
    policy_id: UUID,
    payment_id: UUID,
    payload: schemas.PaymentExpenseCreate,
    service: PaymentService = Depends(get_payment_service),
) -> schemas.PaymentExpenseRead:
    try:
        payment, expense = await service.create_expense(deal_id, policy_id, payment_id, payload)
    except RepositoryError as exc:
        _handle_repository_error(exc)
    if payment is None or expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="payment_not_found")
    return expense

router.add_api_route(
    "",
    create_expense,
    methods=["POST"],
    response_model=schemas.PaymentExpenseRead,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)

@router.patch("/{expense_id}", response_model=schemas.PaymentExpenseRead)
async def update_expense(
    deal_id: UUID,
    policy_id: UUID,
    payment_id: UUID,
    expense_id: UUID,
    payload: schemas.PaymentExpenseUpdate,
    service: PaymentService = Depends(get_payment_service),
) -> schemas.PaymentExpenseRead:
    try:
        payment, expense = await service.update_expense(
            deal_id, policy_id, payment_id, expense_id, payload
        )
    except RepositoryError as exc:
        _handle_repository_error(exc)
    if payment is None or expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="expense_not_found")
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_expense(
    deal_id: UUID,
    policy_id: UUID,
    payment_id: UUID,
    expense_id: UUID,
    service: PaymentService = Depends(get_payment_service),
    deleted_by_id: UUID | None = Query(default=None),
) -> Response:
    payment = await service.delete_expense(
        deal_id,
        policy_id,
        payment_id,
        expense_id,
        deleted_by_id=deleted_by_id,
    )
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="expense_not_found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
