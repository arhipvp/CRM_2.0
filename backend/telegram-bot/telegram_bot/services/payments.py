from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from uuid import UUID

from telegram_bot.clients.auth import AuthUser
from telegram_bot.clients.crm import CRMClient
from telegram_bot.clients.notifications import NotificationsClient
from telegram_bot.events.publisher import IntegrationEvent, IntegrationEventPublisher


@dataclass(slots=True)
class PaymentContext:
    deal_id: UUID
    policy_id: UUID
    payment_id: UUID
    planned_amount: float | None = None


class PaymentService:
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

    async def confirm_payment(
        self,
        user: AuthUser,
        context: PaymentContext,
        *,
        actual_date: date | None = None,
        trace_id: str | None = None,
    ) -> None:
        tenant_id = user.tenant_id
        actual_date = actual_date or date.today()
        await self._crm.update_payment(
            tenant_id,
            context.deal_id,
            context.policy_id,
            context.payment_id,
            status="posted",
            actual_date=actual_date,
            recorded_by_id=user.id,
        )
        event = IntegrationEvent(
            routing_key="deal.payment.updated",
            type="crm.deal.payment.updated",
            data={
                "deal_id": str(context.deal_id),
                "policy_id": str(context.policy_id),
                "payment": {
                    "payment_id": str(context.payment_id),
                    "status": "posted",
                    "actual_date": actual_date.isoformat(),
                    "updated_at": datetime.now(tz=timezone.utc).isoformat(),
                    "updated_by_id": str(user.id),
                },
            },
            trace_id=trace_id,
        )
        await self._publisher.publish(self._exchange_crm, event)
        await self._notifications.send_event(
            event_key="payment.confirmed",
            user_id=user.id,
            payload={
                "dealId": str(context.deal_id),
                "paymentId": str(context.payment_id),
                "actualDate": actual_date.isoformat(),
            },
            deduplication_key=f"payment:{context.payment_id}:posted",
        )
