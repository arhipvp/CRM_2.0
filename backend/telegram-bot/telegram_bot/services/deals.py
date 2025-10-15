from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone

from telegram_bot.clients.auth import AuthUser
from telegram_bot.clients.crm import CRMClient, Client, Deal
from telegram_bot.clients.notifications import NotificationsClient
from telegram_bot.events.publisher import IntegrationEvent, IntegrationEventPublisher


@dataclass(slots=True)
class QuickDealData:
    client_name: str
    client_email: str | None
    client_phone: str | None
    title: str
    description: str | None
    next_review_at: date
    value: float | None


@dataclass(slots=True)
class QuickDealResult:
    client: Client
    deal: Deal


class DealService:
    def __init__(
        self,
        crm: CRMClient,
        notifications: NotificationsClient,
        publisher: IntegrationEventPublisher,
        *,
        exchange_crm: str,
    ) -> None:
        self._crm = crm
        self._notifications = notifications
        self._publisher = publisher
        self._exchange_crm = exchange_crm

    async def create_quick_deal(
        self,
        user: AuthUser,
        payload: QuickDealData,
        *,
        trace_id: str | None = None,
    ) -> QuickDealResult:
        tenant_id = user.tenant_id
        client = await self._crm.create_client(
            tenant_id,
            name=payload.client_name,
            owner_id=user.id,
            email=payload.client_email,
            phone=payload.client_phone,
        )
        deal = await self._crm.create_deal(
            tenant_id,
            client_id=client.id,
            owner_id=user.id,
            title=payload.title,
            description=payload.description,
            next_review_at=payload.next_review_at,
            value=payload.value,
        )
        event = IntegrationEvent(
            routing_key="deal.created",
            type="crm.deal.created",
            data={
                "deal_id": str(deal.id),
                "client_id": str(client.id),
                "title": deal.title,
                "status": deal.status,
                "created_at": datetime.now(tz=timezone.utc).isoformat(),
                "sales_agent_id": str(user.id),
            },
            trace_id=trace_id,
        )
        await self._publisher.publish(self._exchange_crm, event)
        await self._notifications.send_event(
            event_key="deal.quick.created",
            user_id=user.id,
            payload={
                "dealId": str(deal.id),
                "clientId": str(client.id),
                "title": deal.title,
            },
            deduplication_key=f"quick-deal:{deal.id}",
        )
        return QuickDealResult(client=client, deal=deal)
