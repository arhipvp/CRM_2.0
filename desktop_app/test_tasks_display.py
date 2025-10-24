#!/usr/bin/env python3
"""Test script to verify Tasks tab data display"""
import sys
import json
from api_client import APIClient
from config import CRM_TASKS_URL
from logger import logger

# Fix encoding on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def test_tasks_api():
    """Test if Tasks API returns data correctly"""
    print("\n" + "="*60)
    print("TESTING TASKS API DATA RETRIEVAL")
    print("="*60)

    client = APIClient()

    print(f"\nEndpoint: {CRM_TASKS_URL}")

    try:
        tasks = client.get(CRM_TASKS_URL)

        print(f"\n[OK] API Response Status: Success")
        print(f"[OK] Number of Tasks: {len(tasks)}")

        if tasks:
            print("\nTask Details:")
            for i, task in enumerate(tasks, 1):
                print(f"\n  Task {i}:")
                print(f"    - ID:       {task.get('id')}")
                print(f"    - Title:    {task.get('title')}")
                print(f"    - Status:   {task.get('status')}")
                print(f"    - Priority: {task.get('priority')}")
                print(f"    - Due Date: {task.get('due_date')}")
                print(f"    - Description: {task.get('description')}")

                # Check data types
                print(f"    - Data Types: ", end="")
                checks = [
                    isinstance(task.get('id'), str),
                    isinstance(task.get('title'), str),
                    isinstance(task.get('status'), str),
                    isinstance(task.get('priority'), str),
                ]
                if all(checks):
                    print("[OK]")
                else:
                    print("[WARN] Some fields have unexpected types")

            print("\n" + "="*60)
            print("RESULT: [OK] Tasks API is working correctly!")
            print("="*60)
            return True
        else:
            print("\n[ERROR] No tasks returned from API")
            return False

    except Exception as e:
        print(f"\n[ERROR] API Error: {e}")
        logger.error(f"Failed to fetch tasks: {e}")
        return False

if __name__ == "__main__":
    success = test_tasks_api()
    exit(0 if success else 1)
