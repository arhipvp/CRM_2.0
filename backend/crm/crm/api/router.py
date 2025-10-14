from __future__ import annotations

from fastapi import APIRouter

from crm.api.routers import (
    clients,
    deals,
    payment_expenses,
    payment_incomes,
    payments,
    permissions,
    policies,
    tasks,
)


def get_api_router() -> APIRouter:
    router = APIRouter()
    router.include_router(clients.router)
    router.include_router(deals.router)
    router.include_router(permissions.router)
    router.include_router(policies.router)
    router.include_router(tasks.router)
    router.include_router(payments.router)
    router.include_router(payment_incomes.router)
    router.include_router(payment_expenses.router)
    return router
