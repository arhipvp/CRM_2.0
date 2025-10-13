"""Data access helpers for aggregated CRM metrics."""

from collections.abc import Sequence
from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from reports.models import deal_pipeline_summary_view


async def fetch_deal_pipeline_summary(session: AsyncSession) -> Sequence[dict[str, Any]]:
    """Return aggregated pipeline metrics grouped by deal status."""

    query: Select = select(deal_pipeline_summary_view).order_by(deal_pipeline_summary_view.c.status)
    result = await session.execute(query)
    return [dict(row._mapping) for row in result]


__all__ = ["fetch_deal_pipeline_summary"]
