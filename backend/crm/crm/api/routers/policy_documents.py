from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from crm.app.dependencies import get_policy_service, get_tenant_id
from crm.domain import schemas
from crm.domain.services import PolicyService
from crm.infrastructure.repositories import RepositoryError

router = APIRouter(prefix="/policies/{policy_id}/documents", tags=["policy-documents"])


@router.get("/", response_model=list[schemas.PolicyDocumentRead])
async def list_policy_documents(
    policy_id: UUID,
    service: Annotated[PolicyService, Depends(get_policy_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> list[schemas.PolicyDocumentRead]:
    documents = await service.list_policy_documents(tenant_id, policy_id)
    if documents is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="policy_not_found")
    return list(documents)


@router.post("/", response_model=schemas.PolicyDocumentRead, status_code=status.HTTP_201_CREATED)
async def attach_policy_document(
    policy_id: UUID,
    payload: schemas.PolicyDocumentLink,
    service: Annotated[PolicyService, Depends(get_policy_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> schemas.PolicyDocumentRead:
    try:
        document = await service.attach_document(tenant_id, policy_id, payload.document_id)
    except RepositoryError as exc:
        message = str(exc)
        if message == "document_already_linked":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="document_already_linked") from exc
        if message == "document_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="document_not_found") from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message) from exc
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="policy_not_found")
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def detach_policy_document(
    policy_id: UUID,
    document_id: UUID,
    service: Annotated[PolicyService, Depends(get_policy_service)],
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
) -> Response:
    result = await service.detach_document(tenant_id, policy_id, document_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="policy_not_found")
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="document_not_linked")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
