#!/usr/bin/env python3
"""Script to load test data into CRM API"""
import requests
import json
import sys
from datetime import datetime, timedelta
from config import API_BASE_URL, API_TIMEOUT

# Fix Unicode on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = API_BASE_URL

def create_client(name, email, phone):
    """Create a test client"""
    url = f"{BASE_URL}/clients"
    data = {
        "name": name,
        "email": email,
        "phone": phone,
        "status": "active"
    }
    try:
        response = requests.post(url, json=data, timeout=API_TIMEOUT)
        response.raise_for_status()
        result = response.json()
        print(f"[OK] Created client: {name} (ID: {result.get('id', 'N/A')[:8]})")
        return result
    except Exception as e:
        print(f"[ERROR] Failed to create client {name}: {e}")
        return None

def create_deal(title, client_id, description=""):
    """Create a test deal"""
    url = f"{BASE_URL}/deals"
    data = {
        "title": title,
        "client_id": client_id,
        "description": description,
        "status": "active"
    }
    try:
        response = requests.post(url, json=data, timeout=API_TIMEOUT)
        response.raise_for_status()
        result = response.json()
        print(f"[OK] Created deal: {title} (ID: {result.get('id', 'N/A')[:8]})")
        return result
    except Exception as e:
        print(f"[ERROR] Failed to create deal {title}: {e}")
        return None

def create_task(title, deal_id, description="", status="pending", priority="medium"):
    """Create a test task"""
    url = f"{BASE_URL}/tasks"
    data = {
        "title": title,
        "description": description,
        "deal_id": deal_id,
        "status": status,
        "priority": priority,
        "dueAt": (datetime.now() + timedelta(days=7)).isoformat() + "Z"
    }
    try:
        response = requests.post(url, json=data, timeout=API_TIMEOUT)
        response.raise_for_status()
        result = response.json()
        print(f"[OK] Created task: {title} (ID: {result.get('id', 'N/A')[:8]})")
        return result
    except Exception as e:
        print(f"[ERROR] Failed to create task {title}: {e}")
        return None

def create_policy(policy_number, client_id, deal_id=None):
    """Create a test policy"""
    url = f"{BASE_URL}/policies"
    data = {
        "policy_number": policy_number,
        "client_id": client_id,
    }
    if deal_id:
        data["deal_id"] = deal_id

    try:
        response = requests.post(url, json=data, timeout=API_TIMEOUT)
        response.raise_for_status()
        result = response.json()
        print(f"[OK] Created policy: {policy_number} (ID: {result.get('id', 'N/A')[:8]})")
        return result
    except Exception as e:
        print(f"[ERROR] Failed to create policy {policy_number}: {e}")
        return None

def load_test_data():
    """Load comprehensive test data"""
    print("\n" + "="*60)
    print("LOADING TEST DATA")
    print("="*60 + "\n")

    # Create test clients
    print("[*] Creating test clients...")
    clients = []
    client_data = [
        ("Компания A", "manager_a@company.ru", "+7-495-123-45-67"),
        ("Компания B", "manager_b@company.ru", "+7-495-123-45-68"),
        ("Компания C", "manager_c@company.ru", "+7-495-123-45-69"),
        ("ООО Технологии", "contact@tech.ru", "+7-495-999-88-77"),
        ("Иван Петров", "ivan@example.com", "+7-900-123-45-67"),
    ]

    for name, email, phone in client_data:
        client = create_client(name, email, phone)
        if client:
            clients.append(client)

    print(f"\n[SUCCESS] Created {len(clients)} clients\n")

    # Create test deals
    print("[*] Creating test deals...")
    deals = []
    deal_configs = [
        ("Сделка с Компанией A", "Поставка оборудования на сумму 500000 руб"),
        ("Консультационный проект", "Разработка стратегии для Компании B"),
        ("Ремонт помещения", "Полный ремонт офиса 3000 кв.м"),
        ("IT решение", "Внедрение системы управления"),
        ("Маркетинг", "Разработка маркетинговой кампании"),
    ]

    for i, (title, description) in enumerate(deal_configs):
        if i < len(clients):
            deal = create_deal(title, clients[i].get('id'), description)
            if deal:
                deals.append(deal)

    print(f"\n[SUCCESS] Created {len(deals)} deals\n")

    # Create test tasks
    print("[*] Creating test tasks...")
    tasks = []
    task_configs = [
        ("Подготовить смету", "pending", "high"),
        ("Согласовать условия", "pending", "high"),
        ("Провести встречу", "in_progress", "medium"),
        ("Подготовить договор", "pending", "high"),
        ("Получить подпись", "pending", "high"),
        ("Отправить счет", "pending", "medium"),
        ("Провести презентацию", "in_progress", "high"),
        ("Обсудить детали", "pending", "medium"),
        ("Составить отчет", "pending", "low"),
        ("Провести анализ", "pending", "medium"),
    ]

    for i, (title, status, priority) in enumerate(task_configs):
        if deals:  # Only create tasks if we have deals
            deal_idx = i % len(deals)
            task = create_task(title, deals[deal_idx].get('id'), status=status, priority=priority)
            if task:
                tasks.append(task)

    print(f"\n[SUCCESS] Created {len(tasks)} tasks\n")

    # Create test policies
    print("[*] Creating test policies...")
    policies = []
    for i, client in enumerate(clients):
        policy_num = f"POL-{2025}-{1001+i:04d}"
        deal_id = deals[i].get('id') if i < len(deals) else None
        policy = create_policy(policy_num, client.get('id'), deal_id)
        if policy:
            policies.append(policy)

    print(f"\n[SUCCESS] Created {len(policies)} policies\n")

    # Summary
    print("="*60)
    print("TEST DATA LOADING SUMMARY")
    print("="*60)
    print(f"[OK] Clients:   {len(clients)}")
    print(f"[OK] Deals:     {len(deals)}")
    print(f"[OK] Tasks:     {len(tasks)}")
    print(f"[OK] Policies:  {len(policies)}")
    print("="*60 + "\n")

    return {
        "clients": clients,
        "deals": deals,
        "tasks": tasks,
        "policies": policies
    }

if __name__ == "__main__":
    import sys
    try:
        # Allow override of API base URL via command line
        if len(sys.argv) > 1:
            api_url = sys.argv[1]
            globals()['BASE_URL'] = api_url
            print(f"[INFO] Using custom API: {api_url}\n")
        else:
            print(f"\n[INFO] Using API: {BASE_URL}")
            if "8080" in BASE_URL:
                print("[WARNING] Using Gateway (8080) - may fail if documents service is down")
                print("[INFO] To use direct CRM API, run: python load_test_data.py http://localhost:8082/api/v1\n")

        load_test_data()
        print("[SUCCESS] Test data loaded successfully!")
    except KeyboardInterrupt:
        print("\n[WARNING] Interrupted by user")
    except Exception as e:
        print(f"\n[ERROR] Error: {e}")
