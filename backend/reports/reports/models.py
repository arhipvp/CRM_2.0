"""SQLAlchemy table declarations for materialized views."""

from sqlalchemy import BigInteger, Column, DateTime, String, Table

from reports.db import metadata


deal_pipeline_summary_view = Table(
    "deal_pipeline_summary",
    metadata,
    Column("status", String(length=50), primary_key=True),
    Column("total_deals", BigInteger, nullable=False),
    Column("first_deal_at", DateTime(timezone=True), nullable=True),
    Column("last_activity_at", DateTime(timezone=True), nullable=True),
)


__all__ = ["deal_pipeline_summary_view"]
