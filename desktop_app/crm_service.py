"""CRM service module for business logic"""
from typing import Optional, Dict, Any, List
from api_client import APIClient
from config import CRM_CLIENTS_URL, CRM_DEALS_URL, CRM_PAYMENTS_URL
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

    def create_client(self, name: str, email: str, phone: str) -> Dict[str, Any]:
        """Create new client"""
        try:
            data = {"name": name, "email": email, "phone": phone}
            client = self.api_client.post(CRM_CLIENTS_URL, data)
            logger.info(f"Created client: {name}")
            return client
        except Exception as e:
            logger.error(f"Failed to create client: {e}")
            raise

    def update_client(self, client_id: str, name: str, email: str, phone: str) -> Dict[str, Any]:
        """Update client"""
        try:
            url = f"{CRM_CLIENTS_URL}/{client_id}"
            data = {"name": name, "email": email, "phone": phone}
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
