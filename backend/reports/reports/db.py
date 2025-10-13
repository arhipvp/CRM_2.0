"""Database utilities for the Reports service."""

from collections.abc import AsyncGenerator

from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from reports.config import get_settings

settings = get_settings()

metadata = MetaData(schema=settings.reports_schema)

_async_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_async_engine() -> AsyncEngine:
    """Lazily create and return the async engine."""

    global _async_engine, _session_factory
    if _async_engine is None:
        _async_engine = create_async_engine(settings.async_database_url, echo=False, pool_pre_ping=True)
        _session_factory = async_sessionmaker(_async_engine, expire_on_commit=False)
    return _async_engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the async session factory bound to the engine."""

    global _session_factory
    if _session_factory is None:
        get_async_engine()
    assert _session_factory is not None
    return _session_factory


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a session."""

    session_factory = get_session_factory()
    async with session_factory() as session:
        yield session


__all__ = ["get_async_engine", "get_session", "metadata"]
