from datetime import UTC, datetime
from uuid import uuid4

import pytest
from unittest.mock import AsyncMock

from crm.domain.schemas import PaymentEvent
from crm.domain.services import PaymentSyncService


@pytest.fixture
def payment_event_factory():
    def _factory(**overrides):
        defaults = {
            "tenant_id": uuid4(),
            "event_id": uuid4(),
            "payment_id": uuid4(),
            "deal_id": uuid4(),
            "policy_id": uuid4(),
            "status": "received",
            "occurred_at": datetime.now(UTC),
            "amount": 100.0,
            "currency": "USD",
            "payload": {},
        }
        defaults.update(overrides)
        return PaymentEvent(**defaults)

    return _factory


@pytest.mark.asyncio
async def test_handle_payment_event_returns_processed_true(payment_event_factory):
    log_repository = AsyncMock()
    deal_repository = AsyncMock()
    log_repository.upsert_from_event = AsyncMock(return_value=object())
    deal_repository.mark_won = AsyncMock()
    service = PaymentSyncService(log_repository, deal_repository)

    event = payment_event_factory()

    result = await service.handle_payment_event(event)

    assert result.processed is True
    log_repository.upsert_from_event.assert_awaited_once_with(event.tenant_id, event)


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["received", "paid_out"])
async def test_mark_won_called_for_supported_statuses(payment_event_factory, status):
    log_repository = AsyncMock()
    deal_repository = AsyncMock()
    log_repository.upsert_from_event = AsyncMock(return_value=object())
    deal_repository.mark_won = AsyncMock()
    service = PaymentSyncService(log_repository, deal_repository)

    event = payment_event_factory(status=status)

    await service.handle_payment_event(event)

    deal_repository.mark_won.assert_awaited_once_with(event.tenant_id, event.deal_id)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status, deal_id",
    [
        ("pending", uuid4()),
        ("failed", uuid4()),
        ("received", None),
        ("paid_out", None),
    ],
)
async def test_mark_won_not_called_for_unsupported_cases(payment_event_factory, status, deal_id):
    log_repository = AsyncMock()
    deal_repository = AsyncMock()
    log_repository.upsert_from_event = AsyncMock(return_value=object())
    deal_repository.mark_won = AsyncMock()
    service = PaymentSyncService(log_repository, deal_repository)

    event = payment_event_factory(status=status, deal_id=deal_id)

    await service.handle_payment_event(event)

    deal_repository.mark_won.assert_not_awaited()
