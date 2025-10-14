from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI

from crm.app import main


@pytest.mark.asyncio()
async def test_lifespan_initialises_events_publisher(monkeypatch: pytest.MonkeyPatch) -> None:
    app = FastAPI()
    class DummyPublisher:
        def __init__(self, *_: object) -> None:
            self.connect = AsyncMock()
            self.close = AsyncMock()

    monkeypatch.setattr(main, "EventsPublisher", DummyPublisher)

    async with main.lifespan(app) as state:
        publisher = state["events_publisher"]
        assert isinstance(publisher, DummyPublisher)
        publisher.connect.assert_awaited_once()
        assert getattr(app.state, "events_publisher", None) is publisher

    publisher.close.assert_awaited_once()


@pytest.mark.asyncio()
async def test_lifespan_handles_connection_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    app = FastAPI()

    class FailingPublisher:
        def __init__(self, *_: object) -> None:
            self.connect = AsyncMock(side_effect=RuntimeError("boom"))
            self.close = AsyncMock()

    monkeypatch.setattr(main, "EventsPublisher", FailingPublisher)

    async with main.lifespan(app) as state:
        assert state["events_publisher"] is None
        assert getattr(app.state, "events_publisher", None) is None

    # close should not be awaited because connect failed
    assert state["events_publisher"] is None
