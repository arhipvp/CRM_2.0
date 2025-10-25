from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from crm.app.dependencies import get_deal_journal_service
from crm.domain import schemas
from crm.domain.services import DealJournalService

router = APIRouter(prefix="/deals/{deal_id}/journal", tags=["deal-journal"])


@router.get("", response_model=schemas.DealJournalEntryList)
async def list_deal_journal(
    deal_id: UUID,
    *,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    service: Annotated[DealJournalService, Depends(get_deal_journal_service)],
) -> schemas.DealJournalEntryList:
    return await service.list_entries(deal_id, limit=limit, offset=offset)


@router.post("", response_model=schemas.DealJournalEntryRead, status_code=status.HTTP_201_CREATED)
async def append_deal_journal_entry(
    deal_id: UUID,
    payload: schemas.DealJournalEntryCreate,
    service: Annotated[DealJournalService, Depends(get_deal_journal_service)],
) -> schemas.DealJournalEntryRead:
    entry = await service.append_entry(deal_id, payload)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="deal_not_found")
    return entry
