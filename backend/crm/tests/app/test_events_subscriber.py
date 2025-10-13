import importlib
import importlib
import json
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from types import ModuleType, SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock
from uuid import uuid4

import pytest
from aio_pika import ExchangeType, Message

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
from crm.domain.schemas import PaymentEvent, PaymentEventResult


@pytest.fixture()
def subscriber() -> PaymentsEventsSubscriber:
    settings = SimpleNamespace(payments_retry_limit=3, events_exchange="crm.events")
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
async def test_setup_topology_declares_expected_entities() -> None:
    settings = sys.modules["crm.app.config"].Settings()
    subscriber = PaymentsEventsSubscriber(settings, session_factory=None)  # type: ignore[arg-type]

    payments_exchange = SimpleNamespace(name="payments-exchange")
    events_exchange = SimpleNamespace(name="events-exchange")
    retry_exchange = SimpleNamespace(name="retry-exchange")
    dlx_exchange = SimpleNamespace(name="dlx-exchange")

    payments_queue = SimpleNamespace(bind=AsyncMock())
    retry_queue = SimpleNamespace(bind=AsyncMock())
    dlx_queue = SimpleNamespace(bind=AsyncMock())

    def declare_exchange_side_effect(name: str, exchange_type: ExchangeType, *, durable: bool) -> SimpleNamespace:
        assert durable is True
        match name:
            case settings.payments_exchange:
                assert exchange_type is ExchangeType.TOPIC
                return payments_exchange
            case settings.events_exchange:
                assert exchange_type is ExchangeType.TOPIC
                return events_exchange
            case settings.payments_retry_exchange:
                assert exchange_type is ExchangeType.DIRECT
                return retry_exchange
            case settings.payments_dlx_exchange:
                assert exchange_type is ExchangeType.FANOUT
                return dlx_exchange
        raise AssertionError(f"Unexpected exchange declaration: {name}")

    declare_queue = AsyncMock(side_effect=[payments_queue, retry_queue, dlx_queue])
    subscriber._channel = SimpleNamespace(
        declare_exchange=AsyncMock(side_effect=declare_exchange_side_effect),
        declare_queue=declare_queue,
        get_queue=AsyncMock(return_value=payments_queue),
        bind=AsyncMock(),
    )

    await subscriber._setup_topology()

    queue_call = declare_queue.await_args_list[0]
    assert queue_call.args[0] == settings.payments_queue
    assert queue_call.kwargs["arguments"] == {
        "x-dead-letter-exchange": retry_exchange.name,
        "x-dead-letter-routing-key": "retry",
    }

    retry_call = declare_queue.await_args_list[1]
    assert retry_call.args[0] == settings.payments_retry_queue
    assert retry_call.kwargs["arguments"] == {
        "x-dead-letter-exchange": payments_exchange.name,
        "x-dead-letter-routing-key": "payments.retry",
        "x-message-ttl": settings.payments_retry_delay_ms,
    }

    payments_queue.bind.assert_awaited_once_with(payments_exchange, routing_key="payments.*")
    retry_queue.bind.assert_awaited_once_with(retry_exchange, routing_key="retry")
    dlx_queue.bind.assert_awaited_once_with(dlx_exchange, routing_key="dead")


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


@pytest.mark.asyncio()
async def test_publish_event_uses_exchange(
    subscriber: PaymentsEventsSubscriber, monkeypatch: pytest.MonkeyPatch
) -> None:
    publish_mock = AsyncMock()
    exchange_stub = SimpleNamespace(publish=publish_mock)
    get_exchange_mock = AsyncMock(return_value=exchange_stub)

    subscriber._channel = SimpleNamespace(get_exchange=get_exchange_mock)

    event = PaymentEvent(
        tenant_id=uuid4(),
        event_id=uuid4(),
        payment_id=uuid4(),
        deal_id=None,
        policy_id=None,
        status="processed",
        occurred_at=datetime.now(timezone.utc),
        amount=100.0,
        currency="USD",
        payload={"source": "test"},
    )

    event_dump = event.model_dump(mode="json")
    mock_model_dump = Mock(return_value=event_dump)

    def _mocked_model_dump(self: PaymentEvent) -> dict:
        return mock_model_dump(self)

    monkeypatch.setattr(PaymentEvent, "model_dump", _mocked_model_dump)

    routing_key = "payments.synced"

    await subscriber._publish_event(routing_key, event)

    get_exchange_mock.assert_awaited_once_with(subscriber._settings.events_exchange)

    publish_mock.assert_awaited_once()
    publish_call = publish_mock.await_args
    message = publish_call.args[0]

    assert json.loads(message.body.decode("utf-8")) == mock_model_dump.return_value
    mock_model_dump.assert_called_once_with(event)
    assert message.headers == {"event": routing_key}
    assert message.content_type == "application/json"
    assert publish_call.kwargs["routing_key"] == routing_key
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
async def test_handle_message_service_error_requeue(
    monkeypatch: pytest.MonkeyPatch, subscriber: PaymentsEventsSubscriber
) -> None:
    class FailingPaymentSyncService:
        pass

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
