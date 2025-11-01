from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, Optional
from uuid import UUID

from api.client import APIClient
from config import Settings, get_settings
from models import Client, Deal, Policy, Task


@dataclass(slots=True)
class DataCache:
    clients: Dict[UUID, Client] = field(default_factory=dict)
    deals: Dict[UUID, Deal] = field(default_factory=dict)
    policies: Dict[UUID, Policy] = field(default_factory=dict)
    tasks: Dict[UUID, Task] = field(default_factory=dict)


class AppContext:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.api = APIClient(
            base_url=self.settings.api_base_url,
            timeout=self.settings.api_timeout,
        )
        self.cache = DataCache()

    # ----- caching helpers --------------------------------------------------
    def update_clients(self, clients: Iterable[Client]) -> None:
        for client in clients:
            self.cache.clients[client.id] = client

    def update_deals(self, deals: Iterable[Deal]) -> None:
        for deal in deals:
            self.cache.deals[deal.id] = deal

    def update_policies(self, policies: Iterable[Policy]) -> None:
        for policy in policies:
            self.cache.policies[policy.id] = policy

    def update_tasks(self, tasks: Iterable[Task]) -> None:
        for task in tasks:
            self.cache.tasks[task.id] = task

    # ----- lookup -----------------------------------------------------------
    def get_client_name(self, client_id: Optional[UUID]) -> str:
        if not client_id:
            return ""
        client = self.cache.clients.get(client_id)
        if client is None:
            try:
                self.update_clients(self.api.fetch_clients())
            except Exception:  # pragma: no cover - network issues
                return ""
            client = self.cache.clients.get(client_id)
        return client.name if client else ""

    def get_deal_title(self, deal_id: Optional[UUID]) -> str:
        if not deal_id:
            return ""
        deal = self.cache.deals.get(deal_id)
        if deal is None:
            try:
                self.update_deals(self.api.fetch_deals())
            except Exception:  # pragma: no cover - network issues
                return ""
            deal = self.cache.deals.get(deal_id)
        return deal.title if deal else ""

    def get_policy(self, policy_id: Optional[UUID]) -> Optional[Policy]:
        if not policy_id:
            return None
        policy = self.cache.policies.get(policy_id)
        if policy is None:
            try:
                self.update_policies(self.api.fetch_policies())
            except Exception:  # pragma: no cover
                return None
            policy = self.cache.policies.get(policy_id)
        return policy

    def get_policy_number(self, policy_id: Optional[UUID]) -> str:
        policy = self.get_policy(policy_id)
        return policy.policy_number if policy else ""

    def close(self) -> None:
        self.api.close()


_GLOBAL_CONTEXT: AppContext | None = None


def init_app_context(settings: Settings | None = None) -> AppContext:
    global _GLOBAL_CONTEXT
    if _GLOBAL_CONTEXT is None:
        _GLOBAL_CONTEXT = AppContext(settings)
    return _GLOBAL_CONTEXT


def get_app_context() -> AppContext:
    if _GLOBAL_CONTEXT is None:  # pragma: no cover - defensive
        return init_app_context()
    return _GLOBAL_CONTEXT
