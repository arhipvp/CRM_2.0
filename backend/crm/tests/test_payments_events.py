from __future__ import annotations

import asyncio
import json
import os
from datetime import date, datetime, timezone
from uuid import UUID, uuid4

import aio_pika
import pytest

os.environ.setdefault("CRM_DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/db")
os.environ.setdefault("CRM_REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("CRM_RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
os.environ.setdefault("CRM_PERMISSIONS_QUEUE_NAME", "permissions:sync")
os.environ.setdefault("CRM_PERMISSIONS_QUEUE_PREFIX", "bull")
os.environ.setdefault("CRM_PERMISSIONS_JOB_NAME", "permissions.sync")
os.environ.setdefault("CRM_PERMISSIONS_REDIS_URL", "redis://localhost:6379/0")

from crm.app import config as app_config
from crm.app.events import PaymentsEventsSubscriber
from crm.infrastructure.db import AsyncSessionFactory
from crm.infrastructure.repositories import (
    ClientRepository,
    DealRepository,
    PaymentSyncLogRepository,
)


@pytest.mark.asyncio
async def test_payments_event_processing(apply_migrations):
    tenant_id = uuid4()
    owner_id = uuid4()

    async with AsyncSessionFactory() as session:
        client_repo = ClientRepository(session)
        client = await client_repo.create(
            tenant_id,
            {
                "name": "Test Client",
                "email": None,
                "phone": None,
                "status": "active",
                "owner_id": owner_id,
            },
        )
        deal_repo = DealRepository(session)
        deal = await deal_repo.create(
            tenant_id,
            {
                "client_id": client.id,
                "title": "Deal",
                "description": "",
                "status": "draft",
                "owner_id": owner_id,
                "value": 1000,
                "next_review_at": date.today(),
            },
        )

    subscriber = PaymentsEventsSubscriber(app_config.settings, AsyncSessionFactory)
    await subscriber.start()

    connection = await aio_pika.connect_robust(str(app_config.settings.rabbitmq_url))
    channel = await connection.channel()
    crm_exchange = await channel.declare_exchange(app_config.settings.events_exchange, aio_pika.ExchangeType.TOPIC, durable=True)
    result_queue = await channel.declare_queue(exclusive=True, auto_delete=True)
    await result_queue.bind(crm_exchange, routing_key="payments.synced")

    payments_exchange = await channel.declare_exchange(app_config.settings.payments_exchange, aio_pika.ExchangeType.TOPIC, durable=True)

    event_payload = {
        "tenant_id": str(tenant_id),
        "event_id": str(uuid4()),
        "payment_id": str(uuid4()),
        "deal_id": str(deal.id),
        "policy_id": None,
        "status": "received",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "amount": 1000,
        "currency": "RUB",
        "payload": {"source": "pytest"},
    }

    message = aio_pika.Message(body=json.dumps(event_payload).encode("utf-8"), content_type="application/json")
    await payments_exchange.publish(message, routing_key="payments.test")

    incoming = await asyncio.wait_for(result_queue.get(no_ack=False), timeout=10)
    processed_payload = json.loads(incoming.body)
    await incoming.ack()

    await connection.close()
    await subscriber.stop()

    async with AsyncSessionFactory() as session:
        log_repo = PaymentSyncLogRepository(session)
        record = await log_repo.get_by_event(UUID(event_payload["event_id"]))
        assert record is not None
        assert record.status == "received"

        deal_repo = DealRepository(session)
        updated_deal = await deal_repo.get(tenant_id, deal.id)
        assert updated_deal is not None
        assert updated_deal.status == "won"

    assert processed_payload["event_id"] == event_payload["event_id"]
