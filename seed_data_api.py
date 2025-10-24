#!/usr/bin/env python3
"""Seed script to populate CRM with test data via API"""

import requests
import json
from datetime import datetime, date, timedelta
from random import choice, randint, uniform
from decimal import Decimal

# API configuration
API_BASE_URL = "http://localhost:8082/api/v1"
HEADERS = {"Content-Type": "application/json"}

# Sample data
FIRST_NAMES = [
    "Александр", "Иван", "Петр", "Сергей", "Владимир",
    "Андрей", "Константин", "Дмитрий", "Алексей", "Павел",
    "Ольга", "Мария", "Анна", "Елена", "Наталья"
]

LAST_NAMES = [
    "Иванов", "Петров", "Сидоров", "Козлов", "Волков",
    "Смирнов", "Соколов", "Лебедев", "Морозов", "Павлов",
    "Иванова", "Петрова", "Сидорова", "Козлова", "Волкова"
]

INSURANCE_COMPANIES = [
    "РОСГОССТРАХ", "АльфаСтрахование", "Ингосстрах", "Сбербанк страхование",
    "Тинькоф страхование", "Ренессанс страховая", "Ресо-Гарантия", "Мегаполис"
]

PROGRAM_NAMES = [
    "Стандартная программа", "Премиум+ программа", "ВИП программа",
    "Комплексная защита", "Базовое страхование", "Расширенное покрытие"
]


def create_clients(count=15):
    """Create client records"""
    print("\n[CREATE] Clients...")
    clients = []

    for i in range(count):
        first_name = choice(FIRST_NAMES)
        last_name = choice(LAST_NAMES)

        data = {
            "name": f"{first_name} {last_name}",
            "email": f"{first_name.lower()}.{last_name.lower()}{i}@example.com",
            "phone": f"+7 {randint(900, 999)} {randint(100, 999)}-{randint(10, 99)}-{randint(10, 99)}",
            "status": choice(["active", "inactive"])
        }

        try:
            response = requests.post(
                f"{API_BASE_URL}/clients",
                json=data,
                headers=HEADERS,
                timeout=10
            )
            if response.status_code in [200, 201]:
                client = response.json()
                clients.append(client)
                print(f"  [OK] Created client: {client.get('id')}")
            else:
                print(f"  [WARN] Failed to create client: {response.status_code}")
        except Exception as e:
            print(f"  [ERROR] Exception creating client: {e}")

    print(f"[OK] Created {len(clients)} clients")
    return clients


def create_deals(clients, count=15):
    """Create deal records"""
    print("\n[CREATE] Deals...")
    deals = []

    for i in range(count):
        if not clients:
            print("[WARN] No clients available, skipping deals")
            return deals

        client = choice(clients)
        data = {
            "client_id": client.get("id"),
            "title": f"Deal {randint(1000, 9999)}",
            "description": "Description for deal about insurance services and coverage",
            "status": choice(["draft", "in_progress", "won", "lost"]),
            "next_review_at": (date.today() + timedelta(days=randint(1, 30))).isoformat()
        }

        try:
            response = requests.post(
                f"{API_BASE_URL}/deals",
                json=data,
                headers=HEADERS,
                timeout=10
            )
            if response.status_code in [200, 201]:
                deal = response.json()
                deals.append(deal)
                print(f"  [OK] Created deal: {deal.get('id')}")
            else:
                print(f"  [WARN] Failed to create deal: {response.status_code}")
        except Exception as e:
            print(f"  [ERROR] Exception creating deal: {e}")

    print(f"[OK] Created {len(deals)} deals")
    return deals


def create_policies(clients, count=15):
    """Create policy records"""
    print("\n[CREATE] Policies...")
    policies = []

    for i in range(count):
        if not clients:
            print("[WARN] No clients available, skipping policies")
            return policies

        client = choice(clients)
        data = {
            "client_id": client.get("id"),
            "policy_number": f"POL-{randint(100000, 999999)}",
            "status": choice(["draft", "active", "inactive"]),
            "premium": round(uniform(10000, 500000), 2),
            "effective_from": date.today().isoformat(),
            "effective_to": (date.today() + timedelta(days=365)).isoformat()
        }

        try:
            response = requests.post(
                f"{API_BASE_URL}/policies",
                json=data,
                headers=HEADERS,
                timeout=10
            )
            if response.status_code in [200, 201]:
                policy = response.json()
                policies.append(policy)
                print(f"  [OK] Created policy: {policy.get('id')}")
            else:
                print(f"  [WARN] Failed to create policy: {response.status_code} - {response.text[:100]}")
        except Exception as e:
            print(f"  [ERROR] Exception creating policy: {e}")

    print(f"[OK] Created {len(policies)} policies")
    return policies


def create_calculations(deals, count=15):
    """Create calculation records"""
    print("\n[CREATE] Calculations...")
    calculations = []

    for i in range(count):
        if not deals:
            print("[WARN] No deals available, skipping calculations")
            return calculations

        deal = choice(deals)
        data = {
            "deal_id": deal.get("id"),
            "insurance_company": choice(INSURANCE_COMPANIES),
            "program_name": choice(PROGRAM_NAMES),
            "premium_amount": round(uniform(50000, 300000), 2),
            "coverage_sum": round(uniform(500000, 5000000), 2),
            "calculation_date": (date.today() - timedelta(days=randint(0, 30))).isoformat(),
            "status": choice(["draft", "ready", "confirmed", "archived"]),
            "comments": "Calculation for deal coverage and premium review"
        }

        try:
            response = requests.post(
                f"{API_BASE_URL}/calculations",
                json=data,
                headers=HEADERS,
                timeout=10
            )
            if response.status_code in [200, 201]:
                calc = response.json()
                calculations.append(calc)
                print(f"  [OK] Created calculation: {calc.get('id')}")
            else:
                print(f"  [WARN] Failed to create calculation: {response.status_code}")
        except Exception as e:
            print(f"  [ERROR] Exception creating calculation: {e}")

    print(f"[OK] Created {len(calculations)} calculations")
    return calculations


def create_tasks(clients, deals, count=15):
    """Create task records"""
    print("\n[CREATE] Tasks...")
    tasks = []

    task_titles = [
        "Подготовить документы", "Согласовать условия", "Связаться с клиентом",
        "Отправить предложение", "Получить подпись", "Провести встречу",
        "Обновить информацию", "Отправить счет", "Провести расчет", "Оформить полис"
    ]

    for i in range(count):
        data = {
            "title": choice(task_titles),
            "description": "Task description for managing deal processes",
            "status": choice(["open", "in_progress", "completed", "closed"]),
            "priority": choice(["low", "normal", "high", "urgent"]),
            "due_date": (date.today() + timedelta(days=randint(1, 30))).isoformat()
        }

        if deals and choice([True, False]):
            data["deal_id"] = choice(deals).get("id")
        if clients and choice([True, False]):
            data["client_id"] = choice(clients).get("id")

        try:
            response = requests.post(
                f"{API_BASE_URL}/tasks",
                json=data,
                headers=HEADERS,
                timeout=10
            )
            if response.status_code in [200, 201]:
                task = response.json()
                tasks.append(task)
                print(f"  [OK] Created task: {task.get('id')}")
            else:
                print(f"  [WARN] Failed to create task: {response.status_code}")
        except Exception as e:
            print(f"  [ERROR] Exception creating task: {e}")

    print(f"[OK] Created {len(tasks)} tasks")
    return tasks


def main():
    """Main seed function"""
    print("=" * 60)
    print("CRM Database Seeding via API")
    print("=" * 60)
    print(f"API Base URL: {API_BASE_URL}")

    try:
        # Check if API is available
        response = requests.get(f"{API_BASE_URL}/clients", timeout=5)
        if response.status_code not in [200, 401]:
            print("[ERROR] API is not responding correctly")
            return
    except Exception as e:
        print(f"[ERROR] Cannot reach API: {e}")
        return

    # Create data in order
    clients = create_clients(count=15)
    deals = create_deals(clients, count=15)
    policies = create_policies(clients, count=15)
    calculations = create_calculations(deals, count=15)
    tasks = create_tasks(clients, deals, count=15)

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Clients: {len(clients)}")
    print(f"Deals: {len(deals)}")
    print(f"Policies: {len(policies)}")
    print(f"Calculations: {len(calculations)}")
    print(f"Tasks: {len(tasks)}")
    print("=" * 60)
    print("[OK] Seeding complete!")


if __name__ == "__main__":
    main()
