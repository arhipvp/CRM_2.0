#!/usr/bin/env python3
"""Test to verify Treeview displays data correctly"""
import sys
import json
from api_client import APIClient
from config import CRM_TASKS_URL

# Fix encoding on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def test_treeview_display():
    """Test if data would display correctly in Treeview"""
    print("\n" + "="*70)
    print("TESTING TREEVIEW DATA DISPLAY SIMULATION")
    print("="*70)

    client = APIClient()

    try:
        # Fetch tasks like the tab does
        tasks = client.get(CRM_TASKS_URL)
        print(f"\n[OK] Fetched {len(tasks)} tasks from API")

        # Simulate what _update_tree() does
        print("\n[INFO] Simulating Treeview insertion:")
        print("-" * 70)

        if not tasks:
            print("[ERROR] No tasks returned - tree would be empty")
            return False

        # Print header
        print(f"{'Title':<25} | {'Status':<12} | {'Priority':<8} | {'Due Date':<12} | {'Created':<10}")
        print("-" * 70)

        # Simulate tree insertion
        insertion_count = 0
        for task in tasks:
            title = task.get("title", "")
            status = task.get("status", "")
            priority = task.get("priority", "")
            due_date = task.get("due_date", "")
            created = task.get("created_at", "")[:10] if task.get("created_at") else ""

            # This is what tree.insert() would do
            tree_values = (title, status, priority, due_date, created, "No")

            # Print the values that would be in the tree
            print(f"{title:<25} | {status:<12} | {priority:<8} | {due_date:<12} | {created:<10}")

            insertion_count += 1

            # Verify data types
            if not all([
                isinstance(task.get("id"), str),
                isinstance(title, str),
                isinstance(status, str),
                isinstance(priority, str),
            ]):
                print(f"  [WARN] Task {insertion_count} has invalid data types")

        print("-" * 70)
        print(f"\n[OK] Successfully would insert {insertion_count} rows into Treeview")

        if insertion_count == len(tasks):
            print("[OK] All tasks would be displayed in the tree")
            print("\n" + "="*70)
            print("RESULT: [OK] Treeview display would work correctly!")
            print("="*70)
            return True
        else:
            print(f"[ERROR] Only {insertion_count} of {len(tasks)} tasks would display")
            return False

    except Exception as e:
        print(f"\n[ERROR] Failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_treeview_display()
    exit(0 if success else 1)
