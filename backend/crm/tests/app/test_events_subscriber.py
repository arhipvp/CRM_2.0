import importlib
import importlib
import sys
from types import ModuleType, SimpleNamespace

import pytest

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


@pytest.fixture()
def subscriber() -> PaymentsEventsSubscriber:
    settings = SimpleNamespace(payments_retry_limit=3)
    # session factory is not used in these tests
    return PaymentsEventsSubscriber(settings, session_factory=None)  # type: ignore[arg-type]


def make_message(headers: dict | None) -> SimpleNamespace:
    return SimpleNamespace(headers=headers)


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
