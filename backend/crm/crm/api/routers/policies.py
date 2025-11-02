from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from crm.app.dependencies import get_policy_service
from crm.domain import schemas
from crm.domain.services import PolicyService

router = APIRouter(prefix="/policies", tags=["policies"])


@router.get("/", response_model=list[schemas.PolicyRead])
async def list_policies(
    service: Annotated[PolicyService, Depends(get_policy_service)],
) -> list[schemas.PolicyRead]:
    return list(await service.list_policies())

router.add_api_route(
    "",
    list_policies,
    methods=["GET"],
    response_model=list[schemas.PolicyRead],
    include_in_schema=False,
)

@router.post("/", response_model=schemas.PolicyRead, status_code=status.HTTP_201_CREATED)
async def create_policy(
    payload: schemas.PolicyCreate,
    service: Annotated[PolicyService, Depends(get_policy_service)],
) -> schemas.PolicyRead:
    return await service.create_policy(payload)

router.add_api_route(
    "",
    create_policy,
    methods=["POST"],
    response_model=schemas.PolicyRead,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)


@router.get("/{policy_id}", response_model=schemas.PolicyRead)
async def get_policy(
    policy_id: UUID,
    service: Annotated[PolicyService, Depends(get_policy_service)],
) -> schemas.PolicyRead:
    policy = await service.get_policy(policy_id)
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="policy_not_found")
    return policy


@router.patch("/{policy_id}", response_model=schemas.PolicyRead)
async def update_policy(
    policy_id: UUID,
    payload: schemas.PolicyUpdate,
    service: Annotated[PolicyService, Depends(get_policy_service)],
) -> schemas.PolicyRead:
    policy = await service.update_policy(policy_id, payload)
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="policy_not_found")
    return policy
