"""Entry point for the Reports FastAPI application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import uvicorn

from reports.api.routes import router as reports_router
from reports.config import get_settings
from reports.db import get_async_engine, get_session


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ensure the engine is disposed on shutdown."""

    engine = get_async_engine()
    try:
        yield
    finally:
        await engine.dispose()


app = FastAPI(title="CRM Reports Service", lifespan=lifespan)
app.include_router(reports_router)


@app.get("/health", tags=["health"])
async def healthcheck(session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    """Simple health endpoint with database probe."""

    await session.execute(text("SELECT 1"))
    return {"status": "ok"}


def run() -> None:
    """Run the FastAPI application with uvicorn."""

    settings = get_settings()
    uvicorn.run(
        "reports.main:app",
        host=settings.service_host,
        port=settings.service_port,
        reload=False,
        factory=False,
    )


__all__ = ["app", "run"]
