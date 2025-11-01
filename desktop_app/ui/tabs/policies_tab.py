from __future__ import annotations

from typing import Sequence

from PySide6.QtWidgets import QMessageBox

from api.client import APIClientError
from core.app_context import AppContext
from models import Policy
from ui.base_table import BaseTableTab


class PoliciesTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=[
                "Policy number",
                "Client",
                "Deal",
                "Status",
                "Premium",
                "Effective from",
                "Effective to",
            ],
            title="Policies",
            parent=parent,
            enable_add=False,
            enable_edit=False,
            enable_delete=False,
        )
        self._context = context

    def load_data(self) -> None:
        try:
            policies = self._context.api.fetch_policies()
            clients = self._context.api.fetch_clients()
            deals = self._context.api.fetch_deals()
        except APIClientError as exc:
            QMessageBox.warning(self, "Load error", str(exc))
            return

        self._context.update_policies(policies)
        self._context.update_clients(clients)
        self._context.update_deals(deals)

        self.populate(self._to_rows(policies))

    def _to_rows(self, policies: list[Policy]):
        for policy in policies:
            client_name = self._context.get_client_name(policy.client_id)
            deal_title = self._context.get_deal_title(policy.deal_id)
            premium = f"{policy.premium:,.2f}" if policy.premium is not None else ""
            yield (
                policy.policy_number,
                client_name,
                deal_title,
                policy.status or "",
                premium,
                policy.effective_from.isoformat() if policy.effective_from else "",
                policy.effective_to.isoformat() if policy.effective_to else "",
            )

