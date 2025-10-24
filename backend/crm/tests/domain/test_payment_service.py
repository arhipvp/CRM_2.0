from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from crm.domain import schemas, services


class _EventRecorder:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, object]]] = []

    async def publish(self, routing_key: str, payload: dict[str, object]) -> None:
        self.calls.append((routing_key, payload))


def _build_service() -> services.PaymentService:
    dummy_repo = SimpleNamespace()
    dummy_events = SimpleNamespace()
    return services.PaymentService(dummy_repo, dummy_repo, dummy_repo, dummy_events)


def _build_payment_schema() -> schemas.PaymentRead:
    timestamp = datetime(2024, 1, 1, tzinfo=timezone.utc)
    return schemas.PaymentRead(
        id=uuid4(),
        deal_id=uuid4(),
        policy_id=uuid4(),
        sequence=1,
        status="scheduled",
        planned_date=date(2024, 1, 15),
        planned_amount=Decimal("100.00"),
        currency="RUB",
        comment=None,
        actual_date=None,
        recorded_by_id=None,
        created_by_id=None,
        updated_by_id=None,
        incomes_total=Decimal("0.00"),
        expenses_total=Decimal("0.00"),
        net_total=Decimal("0.00"),
        created_at=timestamp,
        updated_at=timestamp,
        incomes=[],
        expenses=[],
    )


def _build_income_schema(payment_id) -> schemas.PaymentIncomeRead:
    timestamp = datetime(2024, 1, 2, tzinfo=timezone.utc)
    return schemas.PaymentIncomeRead(
        id=uuid4(),
        payment_id=payment_id,
        amount=Decimal("10.00"),
        currency="RUB",
        category="wire",
        posted_at=date(2024, 1, 20),
        note=None,
        created_by_id=None,
        updated_by_id=None,
        created_at=timestamp,
        updated_at=timestamp,
    )


def _build_expense_schema(payment_id) -> schemas.PaymentExpenseRead:
    timestamp = datetime(2024, 1, 3, tzinfo=timezone.utc)
    return schemas.PaymentExpenseRead(
        id=uuid4(),
        payment_id=payment_id,
        amount=Decimal("5.00"),
        currency="RUB",
        category="fee",
        posted_at=date(2024, 1, 25),
        note=None,
        created_by_id=None,
        updated_by_id=None,
        created_at=timestamp,
        updated_at=timestamp,
    )


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
async def test_income_event_payload_uses_income_id() -> None:
    payment = _build_payment_schema()
    income = _build_income_schema(payment.id)
    events = _EventRecorder()
    service = services.PaymentService(SimpleNamespace(), SimpleNamespace(), SimpleNamespace(), events)

    await service._publish_income_event("deal.payment.income.created", payment, income)

    assert events.calls, "event should be published"
    payload = events.calls[0][1]
    assert payload["income"]["income_id"] == str(income.id)
    assert "id" not in payload["income"]


@pytest.mark.asyncio()
async def test_income_event_previous_omits_identifier() -> None:
    payment = _build_payment_schema()
    income = _build_income_schema(payment.id)
    previous = income.model_copy(update={"amount": Decimal("8.50")})
    events = _EventRecorder()
    service = services.PaymentService(SimpleNamespace(), SimpleNamespace(), SimpleNamespace(), events)

    await service._publish_income_event(
        "deal.payment.income.updated",
        payment,
        income,
        previous=previous,
    )

    payload = events.calls[0][1]
    assert payload["income"]["income_id"] == str(income.id)
    assert "income_id" not in payload["previous"]
    assert "id" not in payload["previous"]


@pytest.mark.asyncio()
async def test_expense_event_payload_uses_expense_id() -> None:
    payment = _build_payment_schema()
    expense = _build_expense_schema(payment.id)
    events = _EventRecorder()
    service = services.PaymentService(SimpleNamespace(), SimpleNamespace(), SimpleNamespace(), events)

    await service._publish_expense_event("deal.payment.expense.created", payment, expense)

    payload = events.calls[0][1]
    assert payload["expense"]["expense_id"] == str(expense.id)
    assert "id" not in payload["expense"]
