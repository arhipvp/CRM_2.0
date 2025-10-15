from __future__ import annotations

from datetime import date
from uuid import UUID, uuid4

import pytest

from telegram_bot.clients.auth import AuthUser
from telegram_bot.events.publisher import InMemoryPublisher
from telegram_bot.services.payments import PaymentContext, PaymentService


class FakeCRMClient:
    def __init__(self) -> None:
        self.updated: dict[str, object] | None = None

    async def update_payment(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        *,
        status: str,
        actual_date: date,
        recorded_by_id: UUID,
    ) -> None:
        self.updated = {
            "deal_id": deal_id,
            "payment_id": payment_id,
            "status": status,
            "actual_date": actual_date,
        }


class FakeNotificationsClient:
    def __init__(self) -> None:
        self.events: list[str] = []

    async def send_event(
        self,
        *,
        event_key: str,
        user_id: UUID,
        payload: dict[str, object],
        deduplication_key: str | None = None,
    ) -> UUID:
        self.events.append(event_key)
        return uuid4()


@pytest.mark.asyncio
async def test_payment_confirmation_publishes_update_event() -> None:
    crm = FakeCRMClient()
    notifications = FakeNotificationsClient()
    publisher = InMemoryPublisher(source="test")
    service = PaymentService(crm, notifications, publisher, exchange_crm="crm.domain")
    user = AuthUser(id=uuid4(), telegram_id=777, tenant_id=uuid4(), roles=["agent"], active=True)
    context = PaymentContext(deal_id=uuid4(), policy_id=uuid4(), payment_id=uuid4())

    await service.confirm_payment(user, context, actual_date=date(2024, 5, 1), trace_id="trace")

    assert crm.updated is not None
    assert crm.updated["status"] == "posted"
    assert len(publisher.published) == 1
    _, event, payload = publisher.published[0]
    assert event.routing_key == "deal.payment.updated"
    assert payload["data"]["payment"]["status"] == "posted"
    assert notifications.events == ["payment.confirmed"]
