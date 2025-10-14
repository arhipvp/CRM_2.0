from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from crm.api.router import get_api_router
from crm.app.config import settings
from crm.app.dependencies import close_permissions_queue

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        yield {}
    finally:
        await close_permissions_queue()


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.include_router(get_api_router(), prefix=settings.api_prefix)

    @app.get("/healthz")
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()


def run() -> None:
    uvicorn.run(
        "crm.app.main:app",
        host=settings.service_host,
        port=settings.service_port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    run()
