"""API routes for the Reports service."""

from collections.abc import Sequence

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from reports.db import get_session
from reports.repositories.aggregates import fetch_deal_pipeline_summary
from reports.schemas import DealPipelineSummary

router = APIRouter(prefix="/api/v1", tags=["aggregates"])


@router.get(
    "/aggregates/deal-pipeline",
    response_model=list[DealPipelineSummary],
    summary="Сводка по сделкам CRM",
)
async def get_deal_pipeline_summary(
    session: AsyncSession = Depends(get_session),
) -> Sequence[DealPipelineSummary]:
    """Возвращает материализованное представление по воронке сделок."""

    rows = await fetch_deal_pipeline_summary(session)
    return [DealPipelineSummary.model_validate(row) for row in rows]


__all__ = ["router"]
