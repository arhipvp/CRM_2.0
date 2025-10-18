"""Pydantic schemas for API responses."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class DealPipelineSummary(BaseModel):
    """Aggregated metrics for CRM deals grouped by status."""

    model_config = ConfigDict(from_attributes=True)

    status: str = Field(description="CRM deal status")
    total_deals: int = Field(ge=0, description="Количество сделок в статусе")
    first_deal_at: datetime | None = Field(default=None, description="Время первой сделки в статусе")
    last_activity_at: datetime | None = Field(default=None, description="Время последнего обновления сделки")


__all__ = ["DealPipelineSummary"]
