"""API client module for CRM requests"""
import requests
from typing import Optional, Dict, Any, List, Callable
from config import API_TIMEOUT
from logger import logger


class UnauthorizedException(Exception):
    """Raised when API returns 401 Unauthorized"""
    pass


class APIClient:
    """Client for making API requests with error handling and token refresh"""

    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token
        self.headers = self._build_headers()
        self.on_unauthorized: Optional[Callable] = None  # Callback for 401 errors

    def _build_headers(self) -> Dict[str, str]:
        """Build request headers with authorization"""
        headers = {"Content-Type": "application/json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

    def set_token(self, token: str) -> None:
        """Set access token"""
        self.access_token = token
        self.headers = self._build_headers()

    def set_unauthorized_callback(self, callback: Callable) -> None:
        """Set callback for unauthorized (401) responses"""
        self.on_unauthorized = callback

    def _handle_response(self, response: requests.Response) -> Optional[Any]:
        """Handle API response and check for errors"""
        if response.status_code == 401:
            logger.warning("Unauthorized (401): Token expired or invalid")
            if self.on_unauthorized:
                self.on_unauthorized()
            raise UnauthorizedException("Token expired or invalid")

        response.raise_for_status()

        # Handle empty responses
        if response.text:
            return response.json()
        return None

    def get(self, url: str) -> Optional[Any]:
        """Make GET request"""
        try:
            response = requests.get(url, headers=self.headers, timeout=API_TIMEOUT)
            return self._handle_response(response)
        except UnauthorizedException:
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"GET request failed: {url} - {e}")
            raise

    def post(self, url: str, data: Dict[str, Any]) -> Optional[Any]:
        """Make POST request"""
        try:
            response = requests.post(url, json=data, headers=self.headers, timeout=API_TIMEOUT)
            return self._handle_response(response)
        except UnauthorizedException:
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"POST request failed: {url} - {e}")
            raise

    def patch(self, url: str, data: Dict[str, Any]) -> Optional[Any]:
        """Make PATCH request"""
        try:
            response = requests.patch(url, json=data, headers=self.headers, timeout=API_TIMEOUT)
            return self._handle_response(response)
        except UnauthorizedException:
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"PATCH request failed: {url} - {e}")
            raise

    def delete(self, url: str) -> None:
        """Make DELETE request"""
        try:
            response = requests.delete(url, headers=self.headers, timeout=API_TIMEOUT)
            self._handle_response(response)
        except UnauthorizedException:
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"DELETE request failed: {url} - {e}")
            raise
