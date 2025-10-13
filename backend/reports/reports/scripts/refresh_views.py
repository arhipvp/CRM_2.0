"""Utility script to refresh materialized views used by the Reports API."""

import asyncio

from sqlalchemy import text
from sqlalchemy.sql import quoted_name

from reports.config import get_settings
from reports.db import get_async_engine


async def refresh_materialized_views() -> None:
    """Refresh materialized views that back the API endpoints."""

    settings = get_settings()
    schema = quoted_name(settings.reports_schema, quote=True)
    view_name = f"{schema}.deal_pipeline_summary"
    engine = get_async_engine()
    async with engine.begin() as connection:
        await connection.execute(text(f'REFRESH MATERIALIZED VIEW CONCURRENTLY {view_name}'))


async def _main() -> None:
    await refresh_materialized_views()


def main() -> None:
    """Entry point for CLI usage."""

    asyncio.run(_main())


if __name__ == "__main__":
    main()
