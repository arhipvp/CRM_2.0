from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


INSERT_PAYMENT_SQL = text(
    """
    INSERT INTO crm.payments (
        id,
        tenant_id,
        deal_id,
        policy_id,
        sequence,
        planned_amount,
        currency
    )
    VALUES (
        :id,
        :tenant_id,
        :deal_id,
        :policy_id,
        :sequence,
        :planned_amount,
        :currency
    )
    """
)


@pytest.mark.asyncio()
async def test_payments_rejects_unknown_deal_or_policy(db_session: AsyncSession) -> None:
    tenant_id = uuid4()
    owner_id = uuid4()
    client_id = uuid4()
    deal_id = uuid4()
    policy_id = uuid4()

    await db_session.execute(
        text(
            """
            INSERT INTO crm.clients (id, tenant_id, owner_id, name)
            VALUES (:id, :tenant_id, :owner_id, :name)
            """
        ),
        {
            "id": client_id,
            "tenant_id": tenant_id,
            "owner_id": owner_id,
            "name": "Test client",
        },
    )
    await db_session.execute(
        text(
            """
            INSERT INTO crm.deals (id, tenant_id, owner_id, client_id, title)
            VALUES (:id, :tenant_id, :owner_id, :client_id, :title)
            """
        ),
        {
            "id": deal_id,
            "tenant_id": tenant_id,
            "owner_id": owner_id,
            "client_id": client_id,
            "title": "Test deal",
        },
    )
    await db_session.execute(
        text(
            """
            INSERT INTO crm.policies (
                id,
                tenant_id,
                owner_id,
                client_id,
                deal_id,
                policy_number
            )
            VALUES (
                :id,
                :tenant_id,
                :owner_id,
                :client_id,
                :deal_id,
                :policy_number
            )
            """
        ),
        {
            "id": policy_id,
            "tenant_id": tenant_id,
            "owner_id": owner_id,
            "client_id": client_id,
            "deal_id": deal_id,
            "policy_number": "TEST-001",
        },
    )
    await db_session.commit()

    with pytest.raises(IntegrityError):
        await db_session.execute(
            INSERT_PAYMENT_SQL,
            {
                "id": uuid4(),
                "tenant_id": tenant_id,
                "deal_id": uuid4(),
                "policy_id": policy_id,
                "sequence": 1,
                "planned_amount": "100.00",
                "currency": "RUB",
            },
        )
        await db_session.commit()
    await db_session.rollback()

    with pytest.raises(IntegrityError):
        await db_session.execute(
            INSERT_PAYMENT_SQL,
            {
                "id": uuid4(),
                "tenant_id": tenant_id,
                "deal_id": deal_id,
                "policy_id": uuid4(),
                "sequence": 2,
                "planned_amount": "200.00",
                "currency": "RUB",
            },
        )
        await db_session.commit()
    await db_session.rollback()

    await db_session.execute(text("DELETE FROM crm.policies WHERE id = :id"), {"id": policy_id})
    await db_session.execute(text("DELETE FROM crm.deals WHERE id = :id"), {"id": deal_id})
    await db_session.execute(text("DELETE FROM crm.clients WHERE id = :id"), {"id": client_id})
    await db_session.commit()
