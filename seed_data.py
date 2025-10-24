#!/usr/bin/env python3
"""Seed script to populate CRM database with test data"""

import os
import sys
from datetime import datetime, date, timedelta
from decimal import Decimal
from uuid import uuid4
from random import choice, randint, uniform, sample
import asyncio

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend', 'crm'))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from crm.infrastructure.models import (
    Client, Deal, DealJournalEntry, Policy, Calculation, Task, Payment,
    PaymentIncome, PaymentExpense
)

# Database URL
DB_URL = os.getenv(
    "CRM_DATABASE_URL",
    "postgresql+asyncpg://crm:crm@localhost:5432/crm"
)
# Add schema parameter for asyncpg
if "?" not in DB_URL:
    DB_URL += "?server_settings[search_path]=crm"

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

DEAL_STATUSES = ["draft", "in_progress", "won", "lost"]
TASK_STATUSES = ["open", "in_progress", "completed", "closed"]
POLICY_STATUSES = ["draft", "active", "inactive"]
CALCULATION_STATUSES = ["draft", "ready", "confirmed", "archived"]
PAYMENT_STATUSES = ["scheduled", "completed", "failed", "cancelled"]

TASK_PRIORITIES = ["low", "normal", "high", "urgent"]
CLIENT_STATUSES = ["active", "inactive"]

PAYMENT_CATEGORIES_INCOME = ["premium_payment", "refund", "interest"]
PAYMENT_CATEGORIES_EXPENSE = ["commission", "payout", "admin_fee"]


async def generate_clients(session: AsyncSession, count: int = 15):
    """Generate and add client records"""
    clients = []
    tenant_id = uuid4()
    owner_id = uuid4()

    for _ in range(count):
        first_name = choice(FIRST_NAMES)
        last_name = choice(LAST_NAMES)
        client = Client(
            id=uuid4(),
            tenant_id=tenant_id,
            owner_id=owner_id,
            name=f"{first_name} {last_name}",
            email=f"{first_name.lower()}.{last_name.lower()}@example.com",
            phone=f"+7 {randint(900, 999)} {randint(100, 999)}-{randint(10, 99)}-{randint(10, 99)}",
            status=choice(CLIENT_STATUSES),
            is_deleted=False
        )
        clients.append(client)
        session.add(client)

    await session.flush()
    print(f"[OK] Created {len(clients)} clients")
    return clients, tenant_id, owner_id


async def generate_deals(session: AsyncSession, clients: list, tenant_id, owner_id, count: int = 15):
    """Generate and add deal records"""
    deals = []

    for _ in range(count):
        deal = Deal(
            id=uuid4(),
            tenant_id=tenant_id,
            owner_id=owner_id,
            client_id=choice(clients).id,
            title=f"Deal {randint(1000, 9999)}",
            description=f"Description for deal about insurance services and coverage",
            status=choice(DEAL_STATUSES),
            next_review_at=date.today() + timedelta(days=randint(1, 30)),
            is_deleted=False
        )
        deals.append(deal)
        session.add(deal)

    await session.flush()
    print(f"[OK] Created {len(deals)} deals")
    return deals


async def generate_journal_entries(session: AsyncSession, deals: list, owner_id):
    """Generate deal journal entries"""
    entries = []
    journal_messages = [
        "Обсудили условия договора",
        "Клиент согласился на предложение",
        "Отправили документы на подпись",
        "Получили подписанные документы",
        "Согласовали сроки платежей",
        "Проведена встреча с клиентом",
        "Обновлена информация о клиенте",
        "Проведено согласование условий"
    ]

    for deal in deals:
        num_entries = randint(2, 5)
        for i in range(num_entries):
            entry = DealJournalEntry(
                id=uuid4(),
                deal_id=deal.id,
                author_id=owner_id,
                body=choice(journal_messages),
                created_at=datetime.now() - timedelta(days=randint(0, 30))
            )
            entries.append(entry)
            session.add(entry)

    await session.flush()
    print(f"[OK] Created {len(entries)} deal journal entries")
    return entries


async def generate_policies(session: AsyncSession, clients: list, deals: list, tenant_id, owner_id, count: int = 15):
    """Generate and add policy records"""
    policies = []

    for _ in range(count):
        policy = Policy(
            id=uuid4(),
            tenant_id=tenant_id,
            owner_id=owner_id,
            client_id=choice(clients).id,
            deal_id=choice(deals).id if deals else None,
            policy_number=f"POL-{randint(100000, 999999)}",
            status=choice(POLICY_STATUSES),
            premium=round(Decimal(uniform(10000, 500000)), 2),
            effective_from=date.today(),
            effective_to=date.today() + timedelta(days=365),
            is_deleted=False
        )
        policies.append(policy)
        session.add(policy)

    await session.flush()
    print(f"[OK] Created {len(policies)} policies")
    return policies


async def generate_calculations(session: AsyncSession, deals: list, tenant_id, owner_id, count: int = 15):
    """Generate and add calculation records"""
    calculations = []

    for _ in range(count):
        calc = Calculation(
            id=uuid4(),
            tenant_id=tenant_id,
            owner_id=owner_id,
            deal_id=choice(deals).id,
            insurance_company=choice(INSURANCE_COMPANIES),
            program_name=choice(PROGRAM_NAMES),
            premium_amount=round(Decimal(uniform(50000, 300000)), 2),
            coverage_sum=round(Decimal(uniform(500000, 5000000)), 2),
            calculation_date=date.today() - timedelta(days=randint(0, 30)),
            status=choice(CALCULATION_STATUSES),
            files=[],
            comments=f"Calculation for deal coverage and premium review",
            is_deleted=False
        )
        calculations.append(calc)
        session.add(calc)

    await session.flush()
    print(f"[OK] Created {len(calculations)} calculations")
    return calculations


async def generate_tasks(session: AsyncSession, clients: list, deals: list, tenant_id, owner_id, count: int = 15):
    """Generate and add task records"""
    tasks = []
    task_titles = [
        "Подготовить документы",
        "Согласовать условия",
        "Связаться с клиентом",
        "Отправить предложение",
        "Получить подпись",
        "Провести встречу",
        "Обновить информацию",
        "Отправить счет",
        "Провести расчет",
        "Оформить полис"
    ]

    for _ in range(count):
        task = Task(
            id=uuid4(),
            tenant_id=tenant_id,
            owner_id=owner_id,
            deal_id=choice(deals).id if deals else None,
            client_id=choice(clients).id if clients else None,
            title=choice(task_titles),
            description=f"Task description for managing deal processes",
            status=choice(TASK_STATUSES),
            priority=choice(TASK_PRIORITIES),
            due_date=date.today() + timedelta(days=randint(1, 30)),
            is_deleted=False
        )
        tasks.append(task)
        session.add(task)

    await session.flush()
    print(f"[OK] Created {len(tasks)} tasks")
    return tasks


async def generate_payments(session: AsyncSession, deals: list, policies: list, tenant_id, owner_id, count: int = 15):
    """Generate and add payment records with incomes and expenses"""
    payments = []

    for _ in range(min(count, len(deals) * len(policies) if deals and policies else 1)):
        deal = choice(deals) if deals else None
        policy = choice(policies) if policies else None

        if not deal or not policy:
            continue

        payment = Payment(
            id=uuid4(),
            tenant_id=tenant_id,
            deal_id=deal.id,
            policy_id=policy.id,
            sequence=randint(1, 12),
            status=choice(PAYMENT_STATUSES),
            planned_date=date.today() + timedelta(days=randint(1, 90)),
            actual_date=date.today() + timedelta(days=randint(0, 60)) if choice([True, False]) else None,
            planned_amount=round(Decimal(uniform(10000, 100000)), 2),
            currency="RUB",
            comment=f"Payment for insurance policy coverage",
            recorded_by_id=owner_id if choice([True, False]) else None,
            created_by_id=owner_id,
            updated_by_id=owner_id if choice([True, False]) else None,
            incomes_total=Decimal(0),
            expenses_total=Decimal(0),
            net_total=Decimal(0)
        )
        payments.append(payment)
        session.add(payment)

    await session.flush()

    # Add incomes and expenses to payments
    for payment in payments:
        # Add 1-2 income entries
        for _ in range(randint(1, 2)):
            income = PaymentIncome(
                id=uuid4(),
                tenant_id=tenant_id,
                payment_id=payment.id,
                amount=round(Decimal(uniform(5000, 50000)), 2),
                currency="RUB",
                category=choice(PAYMENT_CATEGORIES_INCOME),
                posted_at=date.today(),
                note=f"Income entry for payment",
                created_by_id=owner_id,
                updated_by_id=owner_id if choice([True, False]) else None
            )
            session.add(income)

        # Add 0-1 expense entries
        if choice([True, False]):
            expense = PaymentExpense(
                id=uuid4(),
                tenant_id=tenant_id,
                payment_id=payment.id,
                amount=round(Decimal(uniform(1000, 10000)), 2),
                currency="RUB",
                category=choice(PAYMENT_CATEGORIES_EXPENSE),
                posted_at=date.today(),
                note=f"Expense entry for payment",
                created_by_id=owner_id,
                updated_by_id=owner_id if choice([True, False]) else None
            )
            session.add(expense)

    await session.flush()
    print(f"[OK] Created {len(payments)} payments with incomes and expenses")
    return payments


async def main():
    """Main seed function"""
    print("Starting database seeding...")
    print(f"Database URL: {DB_URL}")

    # Create async engine
    engine = create_async_engine(DB_URL, echo=False)

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        try:
            # Generate data in order of dependencies
            clients, tenant_id, owner_id = await generate_clients(session, count=15)
            deals = await generate_deals(session, clients, tenant_id, owner_id, count=15)
            journal_entries = await generate_journal_entries(session, deals, owner_id)
            policies = await generate_policies(session, clients, deals, tenant_id, owner_id, count=15)
            calculations = await generate_calculations(session, deals, tenant_id, owner_id, count=15)
            tasks = await generate_tasks(session, clients, deals, tenant_id, owner_id, count=15)
            payments = await generate_payments(session, deals, policies, tenant_id, owner_id, count=15)

            # Commit all changes
            await session.commit()
            print("\n[OK] All test data created successfully!")
            print(f"\nSummary:")
            print(f"  - Clients: {len(clients)}")
            print(f"  - Deals: {len(deals)}")
            print(f"  - Deal Journal Entries: {len(journal_entries)}")
            print(f"  - Policies: {len(policies)}")
            print(f"  - Calculations: {len(calculations)}")
            print(f"  - Tasks: {len(tasks)}")
            print(f"  - Payments: {len(payments)}")

        except Exception as e:
            await session.rollback()
            print(f"[ERROR] Error during seeding: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
