from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from crm.domain import schemas, services


def _build_service() -> services.PaymentService:
    dummy_repo = SimpleNamespace()
    dummy_events = SimpleNamespace()
    return services.PaymentService(dummy_repo, dummy_repo, dummy_repo, dummy_events)


def test_validate_transaction_allows_same_local_day(monkeypatch: pytest.MonkeyPatch) -> None:
    service = _build_service()
    payment = SimpleNamespace(currency="RUB")

    local_date = date(2024, 3, 1)

    class _FakeNow:
        def astimezone(self, tz: timezone | None = None) -> SimpleNamespace:
            assert tz is None

            class _LocalDate:
                def date(self) -> date:
                    return local_date

            return _LocalDate()

        def date(self) -> None:  # pragma: no cover - защитный сценарий
            raise AssertionError("UTC date should not be used for validation")

    def _fake_now(tz: timezone | None = None) -> _FakeNow:
        assert tz == timezone.utc
        return _FakeNow()

    monkeypatch.setattr(services, "datetime", SimpleNamespace(now=_fake_now))

    # posted_at совпадает с локальной датой сервера (UTC+3),
    # хотя в UTC ещё предыдущее число.
    service._validate_transaction_input(
        payment,
        currency=payment.currency,
        posted_at=local_date,
    )


def test_validate_transaction_accepts_case_insensitive_currency() -> None:
    service = _build_service()
    payment = SimpleNamespace(currency="USD")

    normalized = service._validate_transaction_input(payment, currency=" usd ", posted_at=None)
    assert normalized == "USD"


def test_validate_transaction_normalizes_payment_currency() -> None:
    service = _build_service()
    payment = SimpleNamespace(currency=" usd  ")

    normalized = service._validate_transaction_input(payment, currency="USD", posted_at=None)
    assert normalized == "USD"


def test_validate_transaction_rejects_currency_mismatch() -> None:
    service = _build_service()
    payment = SimpleNamespace(currency="EUR")

    with pytest.raises(services.repositories.RepositoryError) as excinfo:
        service._validate_transaction_input(payment, currency="usd", posted_at=None)

    assert str(excinfo.value) == "currency_mismatch"


def test_validate_transaction_rejects_future_local_day(monkeypatch: pytest.MonkeyPatch) -> None:
    service = _build_service()
    payment = SimpleNamespace(currency="RUB")

    local_today = date(2024, 3, 1)
    future_day = local_today + timedelta(days=1)

    class _FakeNow:
        def astimezone(self, tz: timezone | None = None) -> SimpleNamespace:
            assert tz is None

            class _LocalDate:
                def date(self) -> date:
                    return local_today

            return _LocalDate()

        def date(self) -> None:  # pragma: no cover - защитный сценарий
            raise AssertionError("UTC date should not be used for validation")

    def _fake_now(tz: timezone | None = None) -> _FakeNow:
        assert tz == timezone.utc
        return _FakeNow()

    monkeypatch.setattr(services, "datetime", SimpleNamespace(now=_fake_now))

    with pytest.raises(services.repositories.RepositoryError) as excinfo:
        service._validate_transaction_input(
            payment,
            currency=payment.currency,
            posted_at=future_day,
        )

    assert str(excinfo.value) == "posted_at_in_future"


def test_payment_create_normalizes_currency() -> None:
    payload = schemas.PaymentCreate(
        planned_amount=Decimal("100.00"),
        currency=" rub ",
        planned_date=date(2024, 1, 10),
    )

    assert payload.currency == "RUB"


def test_payment_income_create_normalizes_currency() -> None:
    payload = schemas.PaymentIncomeCreate(
        amount=Decimal("50.00"),
        currency=" usd ",
        category="wire",
        posted_at=date(2024, 1, 10),
    )

    assert payload.currency == "USD"


@pytest.mark.asyncio()
async def test_update_payment_rejects_null_currency() -> None:
    tenant_id = uuid4()
    deal_id = uuid4()
    policy_id = uuid4()
    payment_id = uuid4()
    payment = SimpleNamespace(
        id=payment_id,
        tenant_id=tenant_id,
        deal_id=deal_id,
        policy_id=policy_id,
        status="scheduled",
        currency="RUB",
        planned_amount=Decimal("100.00"),
        planned_date=date.today(),
        actual_date=None,
        incomes_total=Decimal("0"),
        expenses_total=Decimal("0"),
        net_total=Decimal("0"),
        comment=None,
        recorded_by_id=None,
        created_by_id=None,
        updated_by_id=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    payments_repo = SimpleNamespace(
        get_payment=AsyncMock(return_value=payment),
        update_payment=AsyncMock(),
        recalculate_totals=AsyncMock(return_value=payment),
    )
    income_repo = SimpleNamespace()
    expense_repo = SimpleNamespace()
    events = SimpleNamespace(publish=AsyncMock())
    service = services.PaymentService(payments_repo, income_repo, expense_repo, events)

    payload = schemas.PaymentUpdate(currency=None)

    with pytest.raises(services.repositories.RepositoryError) as excinfo:
        await service.update_payment(tenant_id, deal_id, policy_id, payment_id, payload)

    assert str(excinfo.value) == "currency_mismatch"
    payments_repo.update_payment.assert_not_awaited()
    events.publish.assert_not_called()
