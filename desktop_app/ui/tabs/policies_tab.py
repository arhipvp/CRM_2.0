from __future__ import annotations

import logging
from typing import Any, Sequence

from PySide6.QtWidgets import QMessageBox

from api.client import APIClientError
from core.app_context import AppContext
from models import Policy
from ui.base_table import BaseTableTab
from ui.worker import Worker, WorkerPool
from i18n import _

logger = logging.getLogger(__name__)


class PoliciesTab(BaseTableTab):
    def __init__(self, *, context: AppContext, parent=None) -> None:
        super().__init__(
            columns=[
                _("ID"),
                _("Policy number"),
                _("Client"),
                _("Deal"),
                _("Status"),
                _("Premium"),
                _("Effective from"),
                _("Effective to"),
                _("Owner ID"),
                _("Created"),
                _("Updated"),
            ],
            title=_("Policies"),
            parent=parent,
            enable_add=False,
            enable_edit=False,
            enable_delete=False,
        )
        self._context = context
        self._worker_pool = WorkerPool()

    def load_data(self) -> None:
        """Load policies from API in background thread."""
        if self._worker_pool.is_running("load_policies"):
            logger.debug("Policies load already in progress")
            return

        self.data_loading.emit(True)

        def load_policies_task() -> tuple[list[Policy], list, list]:
            policies = self._context.api.fetch_policies()
            clients = self._context.api.fetch_clients()
            deals = self._context.api.fetch_deals()
            return policies, clients, deals

        worker = Worker(load_policies_task)
        worker.finished.connect(self._on_policies_loaded)  # type: ignore[arg-type]
        worker.error.connect(self._on_load_error)  # type: ignore[arg-type]
        self._worker_pool.start("load_policies", worker)

    def _on_policies_loaded(self, result: Any) -> None:
        """Handle successful policies load.

        Args:
            result: Tuple of (policies, clients, deals) from API
        """
        self.data_loading.emit(False)
        if not isinstance(result, tuple) or len(result) != 3:
            self.operation_error.emit(_("Invalid response type"))
            return

        policies, clients, deals = result
        if not isinstance(policies, list):
            self.operation_error.emit(_("Invalid response type"))
            return

        self._context.update_policies(policies)
        self._context.update_clients(clients)
        self._context.update_deals(deals)
        self.populate(self._to_rows(policies))

    def _on_load_error(self, error_message: str) -> None:
        """Handle load error.

        Args:
            error_message: Error description
        """
        self.data_loading.emit(False)

        # Try to show cached data if available
        cached_policies = list(self._context.cache.policies.values())
        if cached_policies:
            logger.warning("API error, showing cached data: %s", error_message)
            self.populate(self._to_rows(cached_policies))
            self.operation_error.emit(_("Showing cached data (network error: {})").format(error_message))
        else:
            # No cache available
            self.operation_error.emit(error_message)

    def _to_rows(self, policies: list[Policy]):
        for policy in policies:
            client_name = self._context.get_client_name(policy.client_id)
            deal_title = self._context.get_deal_title(policy.deal_id)
            premium = f"{policy.premium:,.2f}" if policy.premium is not None else ""
            created = (
                policy.created_at.strftime("%Y-%m-%d %H:%M") if policy.created_at else ""
            )
            updated = (
                policy.updated_at.strftime("%Y-%m-%d %H:%M") if policy.updated_at else ""
            )
            yield (
                str(policy.id),
                policy.policy_number,
                client_name,
                deal_title,
                policy.status or "",
                premium,
                policy.effective_from.isoformat() if policy.effective_from else "",
                policy.effective_to.isoformat() if policy.effective_to else "",
                str(policy.owner_id) if policy.owner_id else "",
                created,
                updated,
            )
