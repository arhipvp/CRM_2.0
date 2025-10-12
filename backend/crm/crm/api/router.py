from __future__ import annotations

from fastapi import APIRouter

from crm.api.routers import clients, deals, policies, tasks


def get_api_router() -> APIRouter:
    router = APIRouter()
    router.include_router(clients.router)
    router.include_router(deals.router)
    router.include_router(policies.router)
    router.include_router(tasks.router)
    return router
