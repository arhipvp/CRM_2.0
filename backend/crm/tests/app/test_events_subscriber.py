import importlib
import importlib
import json
import sys
from contextlib import asynccontextmanager
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock, Mock
from datetime import datetime, timezone
from types import ModuleType, SimpleNamespace
from uuid import uuid4

import pytest
from aio_pika import Message
from unittest.mock import ANY, AsyncMock

if "crm.app.config" not in sys.modules:
    config_module = ModuleType("crm.app.config")

    class DummySettings:
        def __init__(self, payments_retry_limit: int = 3) -> None:
            self.payments_retry_limit = payments_retry_limit
            self.rabbitmq_url = "amqp://guest:guest@localhost:5672/"
            self.payments_queue = "crm.payments-sync"
            self.payments_exchange = "payments.events"
            self.payments_retry_exchange = "crm.payments-sync.retry"
            self.payments_retry_queue = "crm.payments-sync.retry"
            self.payments_dlx_exchange = "crm.payments-sync.dlx"
            self.payments_dlx_queue = "crm.payments-sync.dlx"
            self.payments_retry_delay_ms = 0
            self.events_exchange = "crm.events"

        def model_copy(self, *, update: dict | None = None, **_: object) -> "DummySettings":
            if not update:
                return self
            return DummySettings(payments_retry_limit=update.get("payments_retry_limit", self.payments_retry_limit))

    config_module.Settings = DummySettings
    config_module.settings = DummySettings()

    def get_settings() -> DummySettings:  # noqa: D401 - простой алиас
        """Return cached dummy settings."""

        return config_module.settings

    config_module.get_settings = get_settings
    sys.modules["crm.app.config"] = config_module
    app_module = importlib.import_module("crm.app")
    setattr(app_module, "config", config_module)

from crm.app.events import PaymentsEventsSubscriber
from crm.domain.schemas import PaymentEventResult


@pytest.fixture()
def subscriber() -> PaymentsEventsSubscriber:
    settings = SimpleNamespace(payments_retry_limit=3)
    # session factory is not used in these tests
    return PaymentsEventsSubscriber(settings, session_factory=None)  # type: ignore[arg-type]


def make_message(headers: dict | None) -> SimpleNamespace:
    return SimpleNamespace(headers=headers)


class DummyMessage:
    def __init__(self, body: bytes, headers: dict | None = None) -> None:
        self.body = body
        self.headers = headers
        self.content_type = "application/json"

    @asynccontextmanager
    async def process(self, *, requeue: bool = False) -> "DummyMessage":  # noqa: FBT001
        yield self


def test_should_dead_letter_without_header(subscriber: PaymentsEventsSubscriber) -> None:
    message = make_message(headers=None)

    assert subscriber._should_dead_letter(message) is False


def test_should_dead_letter_before_limit(subscriber: PaymentsEventsSubscriber) -> None:
    message = make_message(headers={"x-death": [{"count": 2}]})

    assert subscriber._should_dead_letter(message) is False


def test_should_dead_letter_at_limit(subscriber: PaymentsEventsSubscriber) -> None:
    message = make_message(headers={"x-death": [{"count": 3}]})

    assert subscriber._should_dead_letter(message) is True


def test_should_dead_letter_with_invalid_count(subscriber: PaymentsEventsSubscriber) -> None:
    message = make_message(headers={"x-death": [{"count": "oops"}]})

    assert subscriber._should_dead_letter(message) is False


@pytest.mark.asyncio()
async def test_handle_message_invalid_json_publishes_to_dlx(
    subscriber: PaymentsEventsSubscriber,
) -> None:
    @asynccontextmanager
    async def dummy_process(**_: object):
        yield

    message = SimpleNamespace(
        body=b"not-json",
        content_type="application/json",
        headers={},
        process=lambda **kwargs: dummy_process(**kwargs),
    )

    subscriber._publish_to_dlx = AsyncMock()
    subscriber._session_factory = Mock(side_effect=AssertionError("should not touch DB"))

    await subscriber._handle_message(message)

    assert subscriber._publish_to_dlx.await_count == 1
    call = subscriber._publish_to_dlx.await_args
    assert call.args[0] is message
    assert isinstance(call.kwargs["reason"], str)
    assert call.kwargs["reason"]
async def test_handle_message_publishes_synced(monkeypatch: pytest.MonkeyPatch) -> None:
    class StubPaymentSyncService:
        def __init__(self, *_: object, **__: object) -> None:
            pass

        async def handle_payment_event(self, event: object) -> PaymentEventResult:
            return PaymentEventResult(processed=True)

    monkeypatch.setattr("crm.app.events.PaymentSyncService", StubPaymentSyncService)

    subscriber = PaymentsEventsSubscriber(SimpleNamespace(payments_retry_limit=3), session_factory=None)  # type: ignore[arg-type]

    @asynccontextmanager
    async def fake_session_factory() -> SimpleNamespace:
        yield SimpleNamespace()

    subscriber._session_factory = fake_session_factory  # type: ignore[assignment]
    subscriber._publish_event = AsyncMock()  # type: ignore[assignment]

    payload = {
        "tenant_id": str(uuid4()),
        "event_id": str(uuid4()),
        "payment_id": str(uuid4()),
        "deal_id": None,
        "policy_id": None,
        "status": "processed",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "amount": 100.0,
        "currency": "USD",
        "payload": {},
    }

    message = DummyMessage(json.dumps(payload).encode("utf-8"))

    await subscriber._handle_message(message)  # type: ignore[arg-type]

    subscriber._publish_event.assert_awaited_once_with("payments.synced", ANY)


@pytest.mark.asyncio()
async def test_handle_message_service_error_dead_letter(monkeypatch: pytest.MonkeyPatch, subscriber: PaymentsEventsSubscriber) -> None:
    class FailingPaymentSyncService:
        def __init__(self, *_: object, **__: object) -> None:
            pass

        async def handle_payment_event(self, event: object) -> PaymentEventResult:
            raise RuntimeError("boom")

    monkeypatch.setattr("crm.app.events.PaymentSyncService", FailingPaymentSyncService)

    @asynccontextmanager
    async def fake_session_factory() -> SimpleNamespace:
        yield SimpleNamespace()

    subscriber._session_factory = fake_session_factory  # type: ignore[assignment]
    subscriber._publish_event = AsyncMock()  # type: ignore[assignment]
    subscriber._publish_to_dlx = AsyncMock()
    subscriber._should_dead_letter = Mock(return_value=True)  # type: ignore[assignment]

    payload = {
        "tenant_id": str(uuid4()),
        "event_id": str(uuid4()),
        "payment_id": str(uuid4()),
        "deal_id": None,
        "policy_id": None,
        "status": "processed",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "amount": 100.0,
        "currency": "USD",
        "payload": {},
    }

    message = DummyMessage(json.dumps(payload).encode("utf-8"))

    await subscriber._handle_message(message)  # type: ignore[arg-type]

    subscriber._publish_to_dlx.assert_awaited_once()


@pytest.mark.asyncio()
async def test_publish_to_dlx_includes_original_headers(subscriber: PaymentsEventsSubscriber) -> None:
    original_headers = {"foo": "bar"}
    message = SimpleNamespace(body=b"payload", content_type="application/json", headers=original_headers)

    exchange = SimpleNamespace(publish=AsyncMock())
    subscriber._channel = SimpleNamespace(get_exchange=AsyncMock(return_value=exchange))  # type: ignore[assignment]
    subscriber._settings.payments_dlx_exchange = "crm.payments-sync.dlx"

    await subscriber._publish_to_dlx(message, reason="boom")

    assert exchange.publish.await_count == 1
    sent_message = exchange.publish.await_args.args[0]
    assert isinstance(sent_message, Message)
    assert sent_message.headers == {"foo": "bar", "dead-letter-reason": "boom"}
    assert exchange.publish.await_args.kwargs["routing_key"] == "dead"


@pytest.mark.asyncio()
async def test_handle_message_service_error_requeue(monkeypatch: pytest.MonkeyPatch, subscriber: PaymentsEventsSubscriber) -> None:
    class FailingPaymentSyncService:
        def __init__(self, *_: object, **__: object) -> None:
            pass

        async def handle_payment_event(self, event: object) -> PaymentEventResult:
            raise RuntimeError("boom")

    monkeypatch.setattr("crm.app.events.PaymentSyncService", FailingPaymentSyncService)

    @asynccontextmanager
    async def fake_session_factory() -> SimpleNamespace:
        yield SimpleNamespace()

    subscriber._session_factory = fake_session_factory  # type: ignore[assignment]
    subscriber._publish_event = AsyncMock()  # type: ignore[assignment]
    subscriber._publish_to_dlx = AsyncMock()
    subscriber._should_dead_letter = Mock(return_value=False)  # type: ignore[assignment]

    payload = {
        "tenant_id": str(uuid4()),
        "event_id": str(uuid4()),
        "payment_id": str(uuid4()),
        "deal_id": None,
        "policy_id": None,
        "status": "processed",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "amount": 100.0,
        "currency": "USD",
        "payload": {},
    }

    message = DummyMessage(json.dumps(payload).encode("utf-8"))

    with pytest.raises(RuntimeError):
        await subscriber._handle_message(message)  # type: ignore[arg-type]

    subscriber._publish_to_dlx.assert_not_awaited()


@pytest.mark.asyncio()
async def test_handle_message_skips_publish_when_not_processed(monkeypatch: pytest.MonkeyPatch) -> None:
    class StubPaymentSyncService:
        def __init__(self, *_: object, **__: object) -> None:
            pass

        async def handle_payment_event(self, event: object) -> PaymentEventResult:
            return PaymentEventResult(processed=False)

    monkeypatch.setattr("crm.app.events.PaymentSyncService", StubPaymentSyncService)

    subscriber = PaymentsEventsSubscriber(SimpleNamespace(payments_retry_limit=3), session_factory=None)  # type: ignore[arg-type]

    @asynccontextmanager
    async def fake_session_factory() -> SimpleNamespace:
        yield SimpleNamespace()

    subscriber._session_factory = fake_session_factory  # type: ignore[assignment]
    subscriber._publish_event = AsyncMock()  # type: ignore[assignment]

    payload = {
        "tenant_id": str(uuid4()),
        "event_id": str(uuid4()),
        "payment_id": str(uuid4()),
        "deal_id": None,
        "policy_id": None,
        "status": "processed",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "amount": 100.0,
        "currency": "USD",
        "payload": {},
    }

    class DummyMessage:
        def __init__(self, body: bytes) -> None:
            self.body = body
            self.headers = None
            self.content_type = "application/json"

        @asynccontextmanager
        async def process(self, *, requeue: bool = False) -> "DummyMessage":  # noqa: FBT001
            yield self

    message = DummyMessage(json.dumps(payload).encode("utf-8"))

    await subscriber._handle_message(message)  # type: ignore[arg-type]

    subscriber._publish_event.assert_not_called()
