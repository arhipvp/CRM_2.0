#!/usr/bin/env python3
"""Diagnostic script to check why tabs appear empty"""
import sys
import json
from api_client import APIClient
from config import CRM_TASKS_URL, CRM_POLICIES_URL, CRM_DEALS_URL
from logger import logger

# Fix encoding on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def diagnose_tabs():
    """Diagnose why tabs are empty"""
    print("\n" + "="*70)
    print("DIAGNOSING EMPTY TABS")
    print("="*70)

    client = APIClient()

    # Test 1: Tasks
    print("\n1. TASKS TAB DIAGNOSIS")
    print("-" * 70)
    try:
        tasks = client.get(CRM_TASKS_URL)
        print(f"[OK] API returned {len(tasks)} tasks")
        if tasks:
            print(f"[INFO] First task: title='{tasks[0].get('title')}', status='{tasks[0].get('status')}'")
            print(f"[INFO] Task has all required fields: {all(k in tasks[0] for k in ['id', 'title', 'status', 'priority'])}")
        else:
            print("[ERROR] No tasks returned")
    except Exception as e:
        print(f"[ERROR] Failed to fetch tasks: {e}")

    # Test 2: Policies
    print("\n2. POLICIES TAB DIAGNOSIS")
    print("-" * 70)
    try:
        policies = client.get(CRM_POLICIES_URL)
        print(f"[OK] API returned {len(policies)} policies")
        if policies:
            print(f"[INFO] First policy: number='{policies[0].get('policy_number')}', status='{policies[0].get('status')}'")
            print(f"[INFO] Policy has all required fields: {all(k in policies[0] for k in ['id', 'policy_number', 'status'])}")
        else:
            print("[ERROR] No policies returned")
    except Exception as e:
        print(f"[ERROR] Failed to fetch policies: {e}")

    # Test 3: Deals (for Calculations)
    print("\n3. CALCULATIONS TAB DIAGNOSIS (needs Deals first)")
    print("-" * 70)
    try:
        deals = client.get(CRM_DEALS_URL)
        print(f"[OK] API returned {len(deals)} deals")
        if deals:
            print(f"[INFO] First deal: title='{deals[0].get('title')}', id='{deals[0].get('id')[:8]}...'")

            # Now try to fetch calculations for first deal
            deal_id = deals[0].get('id')
            calc_url = f"{CRM_DEALS_URL}/{deal_id}/calculations"
            try:
                calculations = client.get(calc_url)
                print(f"[OK] Fetched {len(calculations)} calculations for deal {deal_id[:8]}...")
                if calculations:
                    calc = calculations[0]
                    print(f"[INFO] First calc: company='{calc.get('insurance_company')}', status='{calc.get('status')}'")
            except Exception as calc_e:
                print(f"[WARN] Could not fetch calculations: {calc_e}")
        else:
            print("[ERROR] No deals returned - cannot test calculations")
    except Exception as e:
        print(f"[ERROR] Failed to fetch deals: {e}")

    print("\n" + "="*70)
    print("DIAGNOSIS COMPLETE")
    print("="*70 + "\n")

if __name__ == "__main__":
    diagnose_tabs()
