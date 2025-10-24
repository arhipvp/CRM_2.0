from __future__ import annotations

from datetime import date, timezone, timedelta
from types import SimpleNamespace

import pytest

from crm.domain import services


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

    service._validate_transaction_input(payment, currency=" usd ", posted_at=None)


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
