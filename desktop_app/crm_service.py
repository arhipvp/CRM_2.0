"""CRM service module for business logic"""
from typing import Optional, Dict, Any, List
from api_client import APIClient
from config import (
    CRM_CLIENTS_URL, CRM_DEALS_URL,
    CRM_POLICIES_URL, CRM_TASKS_URL, CRM_USERS_URL
)
from logger import logger


class CRMService:
    """Service for CRM operations"""

    def __init__(self, api_client: APIClient):
        self.api_client = api_client

    # --- Clients Operations ---

    def get_clients(self) -> List[Dict[str, Any]]:
        """Fetch all clients"""
        try:
            clients = self.api_client.get(CRM_CLIENTS_URL)
            logger.info(f"Fetched {len(clients)} clients")
            return clients or []
        except Exception as e:
            logger.error(f"Failed to fetch clients: {e}")
            raise

    def get_client(self, client_id: str) -> Optional[Dict[str, Any]]:
        """Fetch single client by ID"""
        try:
            url = f"{CRM_CLIENTS_URL}/{client_id}"
            client = self.api_client.get(url)
            logger.info(f"Fetched client: {client_id}")
            return client
        except Exception as e:
            logger.error(f"Failed to fetch client {client_id}: {e}")
            raise

    def create_client(self, name: str, email: str, phone: str, **kwargs) -> Dict[str, Any]:
        """Create new client"""
        try:
            data = {"name": name, "email": email, "phone": phone, **kwargs}
            client = self.api_client.post(CRM_CLIENTS_URL, data)
            logger.info(f"Created client: {name}")
            return client
        except Exception as e:
            logger.error(f"Failed to create client: {e}")
            raise

    def update_client(self, client_id: str, name: str, email: str, phone: str, **kwargs) -> Dict[str, Any]:
        """Update client"""
        try:
            url = f"{CRM_CLIENTS_URL}/{client_id}"
            data = {"name": name, "email": email, "phone": phone, **kwargs}
            client = self.api_client.patch(url, data)
            logger.info(f"Updated client: {client_id}")
            return client
        except Exception as e:
            logger.error(f"Failed to update client {client_id}: {e}")
            raise

    def delete_client(self, client_id: str) -> None:
        """Delete client"""
        try:
            url = f"{CRM_CLIENTS_URL}/{client_id}"
            self.api_client.delete(url)
            logger.info(f"Deleted client: {client_id}")
        except Exception as e:
            logger.error(f"Failed to delete client {client_id}: {e}")
            raise

    # --- Deals Operations ---

    def get_deals(self) -> List[Dict[str, Any]]:
        """Fetch all deals"""
        try:
            deals = self.api_client.get(CRM_DEALS_URL)
            logger.info(f"Fetched {len(deals)} deals")
            return deals or []
        except Exception as e:
            logger.error(f"Failed to fetch deals: {e}")
            raise

    def get_deal(self, deal_id: str) -> Optional[Dict[str, Any]]:
        """Fetch single deal by ID"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}"
            deal = self.api_client.get(url)
            logger.info(f"Fetched deal: {deal_id}")
            return deal
        except Exception as e:
            logger.error(f"Failed to fetch deal {deal_id}: {e}")
            raise

    def create_deal(self, title: str, client_id: str, **kwargs) -> Dict[str, Any]:
        """Create new deal"""
        try:
            data = {"title": title, "client_id": client_id, **kwargs}
            deal = self.api_client.post(CRM_DEALS_URL, data)
            logger.info(f"Created deal: {title}")
            return deal
        except Exception as e:
            logger.error(f"Failed to create deal: {e}")
            raise

    def update_deal(self, deal_id: str, **kwargs) -> Dict[str, Any]:
        """Update deal"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}"
            deal = self.api_client.patch(url, kwargs)
            logger.info(f"Updated deal: {deal_id}")
            return deal
        except Exception as e:
            logger.error(f"Failed to update deal {deal_id}: {e}")
            raise

    def delete_deal(self, deal_id: str) -> None:
        """Delete deal"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}"
            self.api_client.delete(url)
            logger.info(f"Deleted deal: {deal_id}")
        except Exception as e:
            logger.error(f"Failed to delete deal {deal_id}: {e}")
            raise

    # --- Payments Operations ---

    def get_payments(self, deal_id: str, policy_id: str) -> List[Dict[str, Any]]:
        """Fetch payments for a deal policy"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/policies/{policy_id}/payments"
            payments = self.api_client.get(url)
            logger.info(f"Fetched payments for deal %s policy %s", deal_id, policy_id)
            return payments or []
        except Exception as e:
            logger.error(f"Failed to fetch payments for deal {deal_id} policy {policy_id}: {e}")
            raise

    def create_payment(self, deal_id: str, policy_id: str, **kwargs) -> Dict[str, Any]:
        """Create new payment"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/policies/{policy_id}/payments"
            payload = self._prepare_payment_payload(kwargs, exclude_keys={"deal_id", "policy_id"})
            payment = self.api_client.post(url, payload)
            logger.info(f"Created payment for deal %s policy %s", deal_id, policy_id)
            return payment
        except Exception as e:
            logger.error(f"Failed to create payment for deal {deal_id} policy {policy_id}: {e}")
            raise

    def update_payment(self, deal_id: str, policy_id: str, payment_id: str, **kwargs) -> Dict[str, Any]:
        """Update payment"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/policies/{policy_id}/payments/{payment_id}"
            payload = self._prepare_payment_payload(kwargs, exclude_keys={"deal_id", "policy_id"})
            payment = self.api_client.patch(url, payload)
            logger.info(f"Updated payment %s for deal %s policy %s", payment_id, deal_id, policy_id)
            return payment
        except Exception as e:
            logger.error(
                f"Failed to update payment {payment_id} for deal {deal_id} policy {policy_id}: {e}"
            )
            raise

    def delete_payment(self, deal_id: str, policy_id: str, payment_id: str) -> None:
        """Delete payment"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/policies/{policy_id}/payments/{payment_id}"
            self.api_client.delete(url)
            logger.info(f"Deleted payment %s for deal %s policy %s", payment_id, deal_id, policy_id)
        except Exception as e:
            logger.error(
                f"Failed to delete payment {payment_id} for deal {deal_id} policy {policy_id}: {e}"
            )
            raise

    @staticmethod
    def _prepare_payment_payload(data: Dict[str, Any], *, exclude_keys: Optional[set[str]] = None) -> Dict[str, Any]:
        """Prepare payload for payment operations"""
        payload = dict(data or {})
        if exclude_keys:
            for key in exclude_keys:
                payload.pop(key, None)
        for field in ("incomes_total", "expenses_total", "net_total"):
            if field in payload:
                payload[field] = CRMService._format_decimal(payload.get(field))
        return payload

    @staticmethod
    def _format_decimal(value: Any) -> str:
        """Format decimal values to strings with two decimals"""
        if value is None or value == "":
            return "0.00"
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return f"{float(value):.2f}"
        try:
            return f"{float(str(value).replace(',', '.')):.2f}"
        except (TypeError, ValueError):
            return "0.00"

    # --- Policies Operations ---

    def get_policies(self) -> List[Dict[str, Any]]:
        """Fetch all policies"""
        try:
            policies = self.api_client.get(CRM_POLICIES_URL)
            logger.info(f"Fetched {len(policies)} policies")
            return policies or []
        except Exception as e:
            logger.error(f"Failed to fetch policies: {e}")
            raise

    def get_deal_policies(self, deal_id: str) -> List[Dict[str, Any]]:
        """Fetch policies that belong to a specific deal."""
        if not deal_id:
            logger.warning("Deal ID is empty when requesting deal policies")
            return []

        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/policies"
            response = self.api_client.get(url)
            if isinstance(response, dict):
                policies = response.get("items", [])
            else:
                policies = response or []
            logger.info(f"Fetched {len(policies)} policies for deal: {deal_id}")
            return policies
        except Exception as e:
            logger.warning(
                f"Failed to fetch policies for deal {deal_id} via dedicated endpoint: {e}. "
                "Falling back to filtering all policies."
            )

        all_policies = self.get_policies()
        filtered_policies = [policy for policy in all_policies if policy.get("deal_id") == deal_id]
        logger.info(f"Filtered {len(filtered_policies)} policies for deal: {deal_id}")
        return filtered_policies

    def get_policy(self, policy_id: str) -> Optional[Dict[str, Any]]:
        """Fetch single policy by ID"""
        try:
            url = f"{CRM_POLICIES_URL}/{policy_id}"
            policy = self.api_client.get(url)
            logger.info(f"Fetched policy: {policy_id}")
            return policy
        except Exception as e:
            logger.error(f"Failed to fetch policy {policy_id}: {e}")
            raise

    def create_policy(self, policy_number: str, client_id: str, **kwargs) -> Dict[str, Any]:
        """Create new policy"""
        try:
            data = {"policy_number": policy_number, "client_id": client_id, **kwargs}
            policy = self.api_client.post(CRM_POLICIES_URL, data)
            logger.info(f"Created policy: {policy_number}")
            return policy
        except Exception as e:
            logger.error(f"Failed to create policy: {e}")
            raise

    def update_policy(self, policy_id: str, **kwargs) -> Dict[str, Any]:
        """Update policy"""
        try:
            url = f"{CRM_POLICIES_URL}/{policy_id}"
            policy = self.api_client.patch(url, kwargs)
            logger.info(f"Updated policy: {policy_id}")
            return policy
        except Exception as e:
            logger.error(f"Failed to update policy {policy_id}: {e}")
            raise

    def delete_policy(self, policy_id: str) -> None:
        """Delete policy"""
        try:
            url = f"{CRM_POLICIES_URL}/{policy_id}"
            self.api_client.delete(url)
            logger.info(f"Deleted policy: {policy_id}")
        except Exception as e:
            logger.error(f"Failed to delete policy {policy_id}: {e}")
            raise

    # --- Tasks Operations ---

    def get_tasks(self) -> List[Dict[str, Any]]:
        """Fetch all tasks"""
        try:
            tasks = self.api_client.get(CRM_TASKS_URL)
            logger.info(f"Fetched {len(tasks)} tasks")
            return tasks or []
        except Exception as e:
            logger.error(f"Failed to fetch tasks: {e}")
            raise

    def get_users(self) -> List[Dict[str, Any]]:
        """Fetch all users/executors"""
        try:
            response = self.api_client.get(CRM_USERS_URL)
            if isinstance(response, dict):
                users = response.get("items", [])
            else:
                users = response or []
            logger.info(f"Fetched {len(users)} users")
            return users
        except Exception as e:
            logger.warning(f"Failed to fetch users: {e}")
            return []

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Fetch single task by ID"""
        try:
            url = f"{CRM_TASKS_URL}/{task_id}"
            task = self.api_client.get(url)
            logger.info(f"Fetched task: {task_id}")
            return task
        except Exception as e:
            logger.error(f"Failed to fetch task {task_id}: {e}")
            raise

    def create_task(self, title: str, **kwargs) -> Dict[str, Any]:
        """Create new task"""
        try:
            data = {"title": title, **kwargs}
            task = self.api_client.post(CRM_TASKS_URL, data)
            logger.info(f"Created task: {title}")
            return task
        except Exception as e:
            logger.error(f"Failed to create task: {e}")
            raise

    def update_task(self, task_id: str, **kwargs) -> Dict[str, Any]:
        """Update task"""
        try:
            url = f"{CRM_TASKS_URL}/{task_id}"
            task = self.api_client.patch(url, kwargs)
            logger.info(f"Updated task: {task_id}")
            return task
        except Exception as e:
            logger.error(f"Failed to update task {task_id}: {e}")
            raise

    def delete_task(self, task_id: str) -> None:
        """Delete task"""
        try:
            url = f"{CRM_TASKS_URL}/{task_id}"
            self.api_client.delete(url)
            logger.info(f"Deleted task: {task_id}")
        except Exception as e:
            logger.error(f"Failed to delete task {task_id}: {e}")
            raise

    # --- Calculations Operations ---

    def get_calculations(self, deal_id: str) -> List[Dict[str, Any]]:
        """Fetch calculations for a deal"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/calculations"
            calculations = self.api_client.get(url)
            logger.info(f"Fetched calculations for deal: {deal_id}")
            return calculations or []
        except Exception as e:
            logger.error(f"Failed to fetch calculations for deal {deal_id}: {e}")
            raise

    def get_calculation(self, deal_id: str, calc_id: str) -> Optional[Dict[str, Any]]:
        """Fetch single calculation"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/calculations/{calc_id}"
            calculation = self.api_client.get(url)
            logger.info(f"Fetched calculation: {calc_id}")
            return calculation
        except Exception as e:
            logger.error(f"Failed to fetch calculation {calc_id}: {e}")
            raise

    def create_calculation(self, deal_id: str, **kwargs) -> Dict[str, Any]:
        """Create new calculation"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/calculations"
            payload = dict(kwargs)
            payload.pop("deal_id", None)
            calculation = self.api_client.post(url, payload)
            logger.info(f"Created calculation for deal: {deal_id}")
            return calculation
        except Exception as e:
            logger.error(f"Failed to create calculation: {e}")
            raise

    def update_calculation(self, deal_id: str, calc_id: str, **kwargs) -> Dict[str, Any]:
        """Update calculation"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/calculations/{calc_id}"
            payload = dict(kwargs)
            payload.pop("deal_id", None)
            calculation = self.api_client.patch(url, payload)
            logger.info(f"Updated calculation: {calc_id}")
            return calculation
        except Exception as e:
            logger.error(f"Failed to update calculation {calc_id}: {e}")
            raise

    def delete_calculation(self, deal_id: str, calc_id: str) -> None:
        """Delete calculation"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/calculations/{calc_id}"
            self.api_client.delete(url)
            logger.info(f"Deleted calculation: {calc_id}")
        except Exception as e:
            logger.error(f"Failed to delete calculation {calc_id}: {e}")
            raise

    # --- Deal Journal Operations ---

    def get_deal_journal(self, deal_id: str, *, limit: int = 200, offset: int = 0) -> Dict[str, Any]:
        """Fetch journal entries for a deal"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/journal?limit={limit}&offset={offset}"
            response = self.api_client.get(url)
            logger.info(f"Fetched journal entries for deal: {deal_id}")
            if isinstance(response, dict):
                items = response.get("items", [])
                total = response.get("total", len(items))
            else:
                items = response or []
                total = len(items)
                response = {"items": items, "total": total}
            return {"items": items, "total": total, **{k: v for k, v in (response or {}).items() if k not in {"items", "total"}}}
        except Exception as e:
            logger.error(f"Failed to fetch journal for deal {deal_id}: {e}")
            raise

    def add_journal_entry(self, deal_id: str, body: str, *, author_id: Optional[str] = None) -> Dict[str, Any]:
        """Add journal entry for a deal"""
        if not author_id:
            raise ValueError("author_id is required to add a journal entry")
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/journal"
            payload = {"body": body, "author_id": author_id}
            entry = self.api_client.post(url, payload)
            logger.info(f"Added journal entry for deal: {deal_id}")
            return entry
        except Exception as e:
            logger.error(f"Failed to add journal entry for deal {deal_id}: {e}")
            raise

    def delete_journal_entry(self, deal_id: str, entry_id: str) -> None:
        """Delete journal entry for a deal"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/journal/{entry_id}"
            self.api_client.delete(url)
            logger.info(f"Deleted journal entry {entry_id} for deal: {deal_id}")
        except Exception as e:
            logger.error(f"Failed to delete journal entry {entry_id} for deal {deal_id}: {e}")
            raise
