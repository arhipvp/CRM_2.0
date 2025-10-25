from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from crm.app.dependencies import get_client_service
from crm.domain import schemas
from crm.domain.services import ClientService

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=list[schemas.ClientRead])
async def list_clients(
    service: Annotated[ClientService, Depends(get_client_service)],
) -> list[schemas.ClientRead]:
    return list(await service.list_clients())


@router.post("", response_model=schemas.ClientRead, status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: schemas.ClientCreate,
    service: Annotated[ClientService, Depends(get_client_service)],
) -> schemas.ClientRead:
    return await service.create_client(payload)


@router.get("/{client_id}", response_model=schemas.ClientRead)
async def get_client(
    client_id: UUID,
    service: Annotated[ClientService, Depends(get_client_service)],
) -> schemas.ClientRead:
    client = await service.get_client(client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="client_not_found")
    return client


@router.patch("/{client_id}", response_model=schemas.ClientRead)
async def update_client(
    client_id: UUID,
    payload: schemas.ClientUpdate,
    service: Annotated[ClientService, Depends(get_client_service)],
) -> schemas.ClientRead:
    client = await service.update_client(client_id, payload)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="client_not_found")
    return client
