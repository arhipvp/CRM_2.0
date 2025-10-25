from __future__ import annotations

from datetime import date
from uuid import UUID, uuid4

import pytest

from telegram_bot.clients.auth import AuthUser
from telegram_bot.clients.crm import Client, Deal
from telegram_bot.events.publisher import InMemoryPublisher
from telegram_bot.services.deals import DealService, QuickDealData


class FakeCRMClient:
    async def create_client(self, *, name: str, owner_id: UUID, email: str | None, phone: str | None) -> Client:
        return Client(id=uuid4(), name=name, email=email, phone=phone)

    async def create_deal(
        self,
        *,
        client_id: UUID,
        owner_id: UUID,
        title: str,
        description: str | None,
        next_review_at: date,
        value: float | None = None,
    ) -> Deal:
        return Deal(id=uuid4(), title=title, status="draft", client_id=client_id, next_review_at=next_review_at)


class FakeNotificationsClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    async def send_event(
        self,
        *,
        event_key: str,
        user_id: UUID,
        payload: dict[str, object],
        deduplication_key: str | None = None,
    ) -> UUID:
        entry = {
            "event_key": event_key,
            "user_id": user_id,
            "payload": payload,
            "deduplication_key": deduplication_key,
        }
        self.calls.append(entry)
        return uuid4()


@pytest.mark.asyncio
async def test_quick_deal_creates_entities_and_publishes_event() -> None:
    crm = FakeCRMClient()
    notifications = FakeNotificationsClient()
    publisher = InMemoryPublisher(source="test")
    service = DealService(crm, notifications, publisher, exchange_crm="crm.domain")
    user = AuthUser(id=uuid4(), telegram_id=12345, roles=["agent"], active=True)
    payload = QuickDealData(
        client_name="ООО Ромашка",
        client_email="client@example.com",
        client_phone="+79990000000",
        title="Страхование",
        description="ДМС для персонала",
        next_review_at=date.today(),
        value=100000.0,
    )

    result = await service.create_quick_deal(user, payload, trace_id="trace-123")

    assert result.deal.title == payload.title
    assert len(publisher.published) == 1
    exchange, event, payload_info = publisher.published[0]
    assert exchange == "crm.domain"
    assert event.routing_key == "deal.created"
    assert event.type == "crm.deal.created"
    assert payload_info["data"]["sales_agent_id"] == str(user.id)
    assert notifications.calls and notifications.calls[0]["event_key"] == "deal.quick.created"
