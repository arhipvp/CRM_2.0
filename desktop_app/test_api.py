#!/usr/bin/env python3
"""Test API connectivity without GUI"""

import json
import os
import sys
import unittest
from pathlib import Path

import requests

if __package__:
    from .config import AUTH_TOKEN_URL, CRM_CLIENTS_URL, normalize_api_base_url
else:  # поддержка запуска скрипта напрямую
    sys.path.append(str(Path(__file__).resolve().parent))
    from config import AUTH_TOKEN_URL, CRM_CLIENTS_URL, normalize_api_base_url


class NormalizeApiBaseUrlTests(unittest.TestCase):
    """Unit-тесты функции нормализации URL."""

    def test_adds_crm_suffix_when_missing(self):
        url = "http://localhost:8080/api/v1"
        expected = "http://localhost:8080/api/v1/crm"

        self.assertEqual(normalize_api_base_url(url), expected)

    def test_preserves_existing_crm_suffix(self):
        url = "http://localhost:8080/api/v1/crm"
        self.assertEqual(normalize_api_base_url(url), url)

    def test_handles_trailing_slash(self):
        url = "http://localhost:8080/api/v1/"
        expected = "http://localhost:8080/api/v1/crm"

        self.assertEqual(normalize_api_base_url(url), expected)

    def test_returns_none_for_empty_value(self):
        self.assertIsNone(normalize_api_base_url(None))


def run_gateway_smoke_tests():
    """Выполнить ручные smoke-проверки Gateway/CRM."""

    print("=" * 60)
    print("Desktop App API Test")
    print("=" * 60)

    # Test 1: Gateway Health Check
    print("\n1. Testing Gateway health check...")
    try:
        response = requests.get("http://localhost:8080/healthz", timeout=5)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            print("   ✅ Gateway is running!")
        else:
            print(f"   ⚠️ Unexpected status: {response.status_code}")
    except Exception as exc:  # pragma: no cover - вспомогательная диагностика
        print(f"   ❌ Error: {exc}")

    # Test 2: Auth Login
    print("\n2. Testing authentication...")
    try:
        # Use test credentials from environment variables
        test_username = os.getenv("TEST_USERNAME", "admin")
        test_password = os.getenv("TEST_PASSWORD", "admin123")
        response = requests.post(
            AUTH_TOKEN_URL,
            json={"username": test_username, "password": test_password},
            timeout=5,
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            token_data = response.json()
            access_token = token_data.get("accessToken")
            print("   ✅ Authentication successful!")
            print(f"   Token: {access_token[:20]}...")

            # Test 3: Fetch Clients
            print("\n3. Testing clients endpoint...")
            headers = {"Authorization": f"Bearer {access_token}"}
            response = requests.get(CRM_CLIENTS_URL, headers=headers, timeout=5)
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                clients = response.json()
                print("   ✅ Clients fetched successfully!")
                print(f"   Total clients: {len(clients)}")
                if clients:
                    print(f"   First client: {clients[0]}")
            else:
                print(f"   ❌ Failed to fetch clients: {response.status_code}")
                print(f"   Response: {response.text}")
        else:
            print(f"   ❌ Authentication failed: {response.status_code}")
            print(f"   Response: {response.text}")
    except Exception as exc:  # pragma: no cover - вспомогательная диагностика
        print(f"   ❌ Error: {exc}")

    print("\n" + "=" * 60)
    print("Test completed!")
    print("=" * 60)


if __name__ == "__main__":
    run_gateway_smoke_tests()
