from __future__ import annotations

from fastapi import APIRouter, Depends

from crm.api import streams
from crm.api.routers import (
    calculations,
    clients,
    deal_journal,
    deals,
    payment_expenses,
    payment_incomes,
    payments,
    permissions,
    policies,
    policy_documents,
    tasks,
)
from crm.app.dependencies import get_current_user


def get_api_router() -> APIRouter:
    router = APIRouter(dependencies=[Depends(get_current_user)])
    router.include_router(clients.router)
    router.include_router(deals.router)
    router.include_router(calculations.router)
    router.include_router(deal_journal.router)
    router.include_router(permissions.router)
    router.include_router(policies.router)
    router.include_router(policy_documents.router)
    router.include_router(tasks.router)
    router.include_router(payments.router)
    router.include_router(payment_incomes.router)
    router.include_router(payment_expenses.router)
    return router


def get_streams_router() -> APIRouter:
    return streams.router
