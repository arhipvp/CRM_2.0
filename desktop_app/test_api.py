#!/usr/bin/env python3
"""Test API connectivity without GUI"""

import requests
import json
import os
from config import AUTH_TOKEN_URL, CRM_CLIENTS_URL

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
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 2: Auth Login
print("\n2. Testing authentication...")
try:
    # Use test credentials from environment variables
    test_username = os.getenv("TEST_USERNAME", "admin")
    test_password = os.getenv("TEST_PASSWORD", "admin123")
    response = requests.post(
        AUTH_TOKEN_URL,
        json={"username": test_username, "password": test_password},
        timeout=5
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        token_data = response.json()
        access_token = token_data.get("accessToken")
        print(f"   ✅ Authentication successful!")
        print(f"   Token: {access_token[:20]}...")

        # Test 3: Fetch Clients
        print("\n3. Testing clients endpoint...")
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(CRM_CLIENTS_URL, headers=headers, timeout=5)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            clients = response.json()
            print(f"   ✅ Clients fetched successfully!")
            print(f"   Total clients: {len(clients)}")
            if clients:
                print(f"   First client: {clients[0]}")
        else:
            print(f"   ❌ Failed to fetch clients: {response.status_code}")
            print(f"   Response: {response.text}")
    else:
        print(f"   ❌ Authentication failed: {response.status_code}")
        print(f"   Response: {response.text}")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "=" * 60)
print("Test completed!")
print("=" * 60)
