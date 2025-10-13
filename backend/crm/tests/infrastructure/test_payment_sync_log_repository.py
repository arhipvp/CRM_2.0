from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from crm.infrastructure import models
from crm.infrastructure.repositories import PaymentSyncLogRepository
from crm.domain import schemas


@pytest.mark.asyncio
async def test_upsert_from_event_updates_existing_record(db_session):
    repo = PaymentSyncLogRepository(db_session)

    tenant_id = uuid4()
    event_id = uuid4()
    payment_id = uuid4()
    occurred_at = datetime.now(timezone.utc)

    initial_event = schemas.PaymentEvent(
        tenant_id=tenant_id,
        event_id=event_id,
        payment_id=payment_id,
        deal_id=uuid4(),
        policy_id=uuid4(),
        status="pending",
        occurred_at=occurred_at,
        amount=150.0,
        currency="USD",
        payload={"source": "initial"},
    )

    created = await repo.upsert_from_event(tenant_id, initial_event)

    updated_event = schemas.PaymentEvent(
        tenant_id=tenant_id,
        event_id=event_id,
        payment_id=payment_id,
        deal_id=initial_event.deal_id,
        policy_id=initial_event.policy_id,
        status="paid",
        occurred_at=occurred_at,
        amount=200.5,
        currency="EUR",
        payload={"source": "update"},
    )

    updated = await repo.upsert_from_event(tenant_id, updated_event)

    assert updated.id == created.id
    assert updated.owner_id == created.owner_id == tenant_id
    assert updated.status == "paid"
    assert float(updated.amount) == pytest.approx(200.5)
    assert updated.currency == "EUR"
    assert updated.payload == {"source": "update"}

    count_result = await db_session.execute(
        select(func.count()).select_from(models.PaymentSyncLog)
    )
    assert count_result.scalar() == 1

    refreshed = await repo.get_by_event(event_id)
    assert refreshed is not None
    assert refreshed.status == updated_event.status
    assert float(refreshed.amount) == pytest.approx(updated_event.amount)
    assert refreshed.currency == updated_event.currency
    assert refreshed.payload == updated_event.payload
