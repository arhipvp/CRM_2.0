from __future__ import annotations

import logging
from typing import Any, Sequence

from PySide6.QtWidgets import QDialog, QMessageBox

from api.client import APIClientError
from core.app_context import AppContext
from models import Client, Deal, Policy
from ui.base_table import BaseTableTab
from ui.dialogs.policy_dialog import PolicyDialog
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
                _("Deleted"),
            ],
            title=_("Policies"),
            parent=parent,
            enable_add=True,
            enable_edit=True,
            enable_delete=True,
        )
        self._context = context
        self._worker_pool = WorkerPool()
        self._policies: list[Policy] = []
        self._clients: list[Client] = []
        self._deals: list[Deal] = []

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
        if not isinstance(policies, list) or not isinstance(clients, list) or not isinstance(deals, list):
            self.operation_error.emit(_("Invalid response type"))
            return

        self._policies = policies
        self._clients = clients
        self._deals = deals

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
            self._policies = cached_policies
            self._clients = list(self._context.cache.clients.values())
            self._deals = list(self._context.cache.deals.values())
            self.populate(self._to_rows(cached_policies))
            self.operation_error.emit(_("Showing cached data (network error: {})").format(error_message))
        else:
            # No cache available
            self.operation_error.emit(error_message)

    def on_add(self) -> None:
        """Show dialog for creating a new policy."""
        if not self._clients:
            QMessageBox.warning(self, _("Create policy"), _("Создайте клиента перед добавлением полиса."))
            return

        dialog = PolicyDialog(
            context=self._context,
            clients=self._clients,
            deals=self._deals,
            status_options=self._collect_status_options(),
            parent=self,
        )
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        payload = dialog.payload()
        if payload is None:
            return

        self.data_loading.emit(True)

        def create_policy_task() -> Policy:
            return self._context.api.create_policy(payload)

        worker = Worker(create_policy_task)
        worker.finished.connect(self._on_policy_created)  # type: ignore[arg-type]
        worker.error.connect(self._on_policy_operation_error)  # type: ignore[arg-type]
        self._worker_pool.start("create_policy", worker)

    def on_edit(self, index: int, row: Sequence[str]) -> None:
        """Edit selected policy."""
        if index < 0 or index >= len(self._policies):
            self.operation_error.emit(_("Policy not found in current selection."))
            return

        policy = self._policies[index]
        dialog = PolicyDialog(
            context=self._context,
            clients=self._clients,
            deals=self._deals,
            status_options=self._collect_status_options(),
            parent=self,
            policy=policy,
        )
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        changes = dialog.update_payload(policy)
        if not changes:
            return

        self.data_loading.emit(True)

        def update_policy_task() -> Policy:
            return self._context.api.update_policy(policy.id, changes)

        worker = Worker(update_policy_task)
        worker.finished.connect(self._on_policy_updated)  # type: ignore[arg-type]
        worker.error.connect(self._on_policy_operation_error)  # type: ignore[arg-type]
        self._worker_pool.start("update_policy", worker)

    def on_delete(self, index: int, row: Sequence[str]) -> None:
        """Handle delete policy action.

        Args:
            index: Row index in table
            row: Row values from table
        """
        if index < 0 or index >= len(self._policies):
            self.operation_error.emit(_("Policy not found in current selection."))
            return

        policy = self._policies[index]
        confirmation = QMessageBox.question(
            self,
            _("Delete policy"),
            _("Delete policy \"{}\"?").format(policy.policy_number),
            QMessageBox.Yes | QMessageBox.No,
        )
        if confirmation != QMessageBox.Yes:
            return

        self.data_loading.emit(True)

        def delete_policy_task() -> None:
            self._context.api.delete_policy(policy.id)

        worker = Worker(delete_policy_task)
        worker.finished.connect(self._on_policy_deleted)
        worker.error.connect(self._on_delete_error)
        self._worker_pool.start("delete_policy", worker)

    def _collect_status_options(self) -> list[str]:
        statuses = {policy.status for policy in self._policies if policy.status}
        if not statuses:
            statuses = {"draft", "active", "suspended", "cancelled"}
        return sorted(statuses)

    def _on_policy_created(self, created_policy: Any) -> None:
        self.data_loading.emit(False)
        if not isinstance(created_policy, Policy):
            self.operation_error.emit(_("Invalid response type"))
            return
        self._context.update_policies([created_policy])
        self.load_data()
        QMessageBox.information(self, _("Success"), _("Policy created."))

    def _on_policy_updated(self, updated_policy: Any) -> None:
        self.data_loading.emit(False)
        if not isinstance(updated_policy, Policy):
            self.operation_error.emit(_("Invalid response type"))
            return
        self._context.update_policies([updated_policy])
        self.load_data()
        QMessageBox.information(self, _("Success"), _("Policy updated."))

    def _on_policy_operation_error(self, error_message: str) -> None:
        self.data_loading.emit(False)
        self.operation_error.emit(_("Failed to process policy: {}").format(error_message))

    def _on_policy_deleted(self, result: Any) -> None:
        """Handle successful policy deletion.

        Args:
            result: Result from API (usually None)
        """
        self.data_loading.emit(False)
        self.load_data()
        QMessageBox.information(self, _("Success"), _("Policy removed."))

    def _on_delete_error(self, error_message: str) -> None:
        """Handle policy deletion error.

        Args:
            error_message: Error description
        """
        self.data_loading.emit(False)
        self.operation_error.emit(_("Failed to delete policy: {}").format(error_message))

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
                _("Yes") if policy.is_deleted else _("No"),
            )
