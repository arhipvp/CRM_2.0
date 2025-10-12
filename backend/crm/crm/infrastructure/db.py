from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.engine import URL, make_url

from crm.app.config import settings


def _build_async_url(raw_url: str) -> URL:
    url = make_url(raw_url)
    if url.drivername.startswith("postgresql+asyncpg"):
        return url
    if url.drivername.startswith("postgresql"):
        return url.set(drivername="postgresql+asyncpg")
    raise ValueError("CRM service currently supports only PostgreSQL DSN")


database_url = _build_async_url(str(settings.database_url))
engine = create_async_engine(database_url, echo=False, future=True, pool_pre_ping=True)

AsyncSessionFactory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionFactory() as session:
        yield session
