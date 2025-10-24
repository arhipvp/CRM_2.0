from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest

from crm.domain import schemas, services


def _build_service() -> services.PaymentService:
    dummy_repo = SimpleNamespace()
    dummy_events = SimpleNamespace()
    return services.PaymentService(dummy_repo, dummy_repo, dummy_repo, dummy_events)


class _AsyncNoopPublisher:
    def __init__(self) -> None:
        self.published: list[tuple[str, dict[str, object]]] = []

    async def publish(self, routing_key: str, payload: dict[str, object]) -> None:
        self.published.append((routing_key, payload))


class _PaymentRepoStub:
    def __init__(self, payment: SimpleNamespace) -> None:
        self.payment = payment
        self.status_updates: list[dict[str, object]] = []

    async def get_payment(
        self,
        tenant_id: UUID,
        deal_id: UUID,
        policy_id: UUID,
        payment_id: UUID,
        *,
        include_incomes: bool = False,
        include_expenses: bool = False,
    ) -> SimpleNamespace:
        return self.payment

    async def recalculate_totals(self, payment: SimpleNamespace) -> SimpleNamespace:
        return payment

    async def update_payment(self, payment: SimpleNamespace, data: dict[str, object]) -> SimpleNamespace:
        if data:
            self.status_updates.append(data)
            for key, value in data.items():
                setattr(payment, key, value)
        return payment


class _IncomeRepoStub:
    def __init__(self, income: SimpleNamespace) -> None:
        self.income = income
        self.updated_payload: dict[str, object] | None = None

    async def get_income(self, tenant_id: UUID, payment_id: UUID, income_id: UUID) -> SimpleNamespace | None:
        if income_id != self.income.id:
            return None
        return self.income

    async def update_income(
        self, income: SimpleNamespace, data: dict[str, object]
    ) -> SimpleNamespace:
        self.updated_payload = data.copy()
        for key, value in data.items():
            setattr(income, key, value)
        return income


class _ExpenseRepoStub:
    def __init__(self, expense: SimpleNamespace | None = None) -> None:
        self.expense = expense
        self.updated_payload: dict[str, object] | None = None

    async def get_expense(
        self, tenant_id: UUID, payment_id: UUID, expense_id: UUID
    ) -> SimpleNamespace | None:
        if self.expense is None or expense_id != self.expense.id:
            return None
        return self.expense

    async def update_expense(
        self, expense: SimpleNamespace, data: dict[str, object]
    ) -> SimpleNamespace:
        self.updated_payload = data.copy()
        for key, value in data.items():
            setattr(expense, key, value)
        return expense


def _build_payment(currency: str = "USD") -> SimpleNamespace:
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uuid4(),
        tenant_id=uuid4(),
        deal_id=uuid4(),
        policy_id=uuid4(),
        sequence=1,
        status="scheduled",
        planned_date=date(2024, 1, 1),
        actual_date=None,
        planned_amount=Decimal("100.00"),
        currency=currency,
        comment=None,
        recorded_by_id=None,
        created_by_id=None,
        updated_by_id=None,
        incomes_total=Decimal("0"),
        expenses_total=Decimal("0"),
        net_total=Decimal("0"),
        created_at=now,
        updated_at=now,
        incomes=[],
        expenses=[],
    )


def _build_income(payment: SimpleNamespace, currency: str = "USD") -> SimpleNamespace:
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uuid4(),
        payment_id=payment.id,
        amount=Decimal("10.00"),
        currency=currency,
        category="wire",
        posted_at=date(2024, 1, 1),
        note=None,
        created_by_id=None,
        updated_by_id=None,
        created_at=now,
        updated_at=now,
    )


def _build_expense(payment: SimpleNamespace, currency: str = "USD") -> SimpleNamespace:
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uuid4(),
        payment_id=payment.id,
        amount=Decimal("15.00"),
        currency=currency,
        category="fee",
        posted_at=date(2024, 1, 2),
        note=None,
        created_by_id=None,
        updated_by_id=None,
        created_at=now,
        updated_at=now,
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
async def test_update_income_accepts_payload_currency() -> None:
    payment = _build_payment(currency="USD")
    income = _build_income(payment, currency="EUR")
    payments_repo = _PaymentRepoStub(payment)
    incomes_repo = _IncomeRepoStub(income)
    expenses_repo = _ExpenseRepoStub()
    events = _AsyncNoopPublisher()
    service = services.PaymentService(payments_repo, incomes_repo, expenses_repo, events)

    payload = schemas.PaymentIncomeUpdate(currency=" usd ")

    payment_result, updated_income = await service.update_income(
        payment.tenant_id,
        payment.deal_id,
        payment.policy_id,
        payment.id,
        income.id,
        payload,
    )

    assert payment_result is not None
    assert updated_income is not None
    assert updated_income.currency == "USD"
    assert incomes_repo.updated_payload is not None
    assert incomes_repo.updated_payload["currency"] == "USD"


@pytest.mark.asyncio()
async def test_update_expense_accepts_payload_currency() -> None:
    payment = _build_payment(currency="USD")
    expense = _build_expense(payment, currency="EUR")
    payments_repo = _PaymentRepoStub(payment)
    incomes_repo = _IncomeRepoStub(_build_income(payment))
    expenses_repo = _ExpenseRepoStub(expense)
    events = _AsyncNoopPublisher()
    service = services.PaymentService(payments_repo, incomes_repo, expenses_repo, events)

    payload = schemas.PaymentExpenseUpdate(currency="usd")

    payment_result, updated_expense = await service.update_expense(
        payment.tenant_id,
        payment.deal_id,
        payment.policy_id,
        payment.id,
        expense.id,
        payload,
    )

    assert payment_result is not None
    assert updated_expense is not None
    assert updated_expense.currency == "USD"
    assert expenses_repo.updated_payload is not None
    assert expenses_repo.updated_payload["currency"] == "USD"
