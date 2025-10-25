"""CRM service module for business logic"""
from typing import Optional, Dict, Any, List
from api_client import APIClient
from config import (
    CRM_CLIENTS_URL, CRM_DEALS_URL, CRM_PAYMENTS_URL,
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

    def get_payments(self, deal_id: str) -> List[Dict[str, Any]]:
        """Fetch payments for a deal"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/payments"
            payments = self.api_client.get(url)
            logger.info(f"Fetched payments for deal: {deal_id}")
            return payments or []
        except Exception as e:
            logger.error(f"Failed to fetch payments for deal {deal_id}: {e}")
            raise

    def create_payment(self, deal_id: str, **kwargs) -> Dict[str, Any]:
        """Create new payment"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/payments"
            payment = self.api_client.post(url, kwargs)
            logger.info(f"Created payment for deal: {deal_id}")
            return payment
        except Exception as e:
            logger.error(f"Failed to create payment: {e}")
            raise

    def update_payment(self, payment_id: str, **kwargs) -> Dict[str, Any]:
        """Update payment"""
        try:
            # Note: Adjust URL if backend uses different structure
            url = f"{CRM_PAYMENTS_URL}/{payment_id}"
            payment = self.api_client.patch(url, kwargs)
            logger.info(f"Updated payment: {payment_id}")
            return payment
        except Exception as e:
            logger.error(f"Failed to update payment {payment_id}: {e}")
            raise

    def delete_payment(self, payment_id: str) -> None:
        """Delete payment"""
        try:
            url = f"{CRM_PAYMENTS_URL}/{payment_id}"
            self.api_client.delete(url)
            logger.info(f"Deleted payment: {payment_id}")
        except Exception as e:
            logger.error(f"Failed to delete payment {payment_id}: {e}")
            raise

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
            calculation = self.api_client.post(url, kwargs)
            logger.info(f"Created calculation for deal: {deal_id}")
            return calculation
        except Exception as e:
            logger.error(f"Failed to create calculation: {e}")
            raise

    def update_calculation(self, deal_id: str, calc_id: str, **kwargs) -> Dict[str, Any]:
        """Update calculation"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/calculations/{calc_id}"
            calculation = self.api_client.patch(url, kwargs)
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

    def get_deal_journal(self, deal_id: str) -> List[Dict[str, Any]]:
        """Fetch journal entries for a deal"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/journal"
            entries = self.api_client.get(url)
            logger.info(f"Fetched journal entries for deal: {deal_id}")
            return entries or []
        except Exception as e:
            logger.error(f"Failed to fetch journal for deal {deal_id}: {e}")
            raise

    def add_journal_entry(self, deal_id: str, body: str) -> Dict[str, Any]:
        """Add journal entry for a deal"""
        try:
            url = f"{CRM_DEALS_URL}/{deal_id}/journal"
            entry = self.api_client.post(url, {"body": body})
            logger.info(f"Added journal entry for deal: {deal_id}")
            return entry
        except Exception as e:
            logger.error(f"Failed to add journal entry for deal {deal_id}: {e}")
            raise
