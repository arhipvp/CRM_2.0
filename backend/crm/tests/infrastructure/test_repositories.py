import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from crm.infrastructure.repositories import (
    BaseRepository,
    ClientRepository,
    DealRepository,
    RepositoryError,
)


class FakeModel:
    def __init__(self, tenant_id, **data):
        self.tenant_id = tenant_id
        for key, value in data.items():
            setattr(self, key, value)


class FakeRepository(BaseRepository[FakeModel]):
    model = FakeModel


def make_fake_session(commit_side_effect=None, execute_result=None):
    session = Mock()
    session.add = Mock()
    session.commit = AsyncMock(side_effect=commit_side_effect)
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock(return_value=execute_result)
    return session


@pytest.mark.asyncio
async def test_create_rolls_back_on_integrity_error():
    session = make_fake_session(
        IntegrityError("stmt", "params", Exception("boom"))
    )
    repo = FakeRepository(session)
    tenant_id = uuid4()

    with pytest.raises(RepositoryError):
        await repo.create(tenant_id, {"field": "value"})

    session.add.assert_called_once()
    session.commit.assert_awaited_once()
    session.rollback.assert_awaited_once()
    session.refresh.assert_not_called()


@pytest.mark.asyncio
async def test_create_successful():
    session = make_fake_session()
    repo = FakeRepository(session)
    tenant_id = uuid4()

    result = await repo.create(tenant_id, {"field": "value"})

    session.add.assert_called_once()
    session.commit.assert_awaited_once()
    session.rollback.assert_not_called()
    session.refresh.assert_awaited_once_with(result)
    assert result.tenant_id == tenant_id
    assert result.field == "value"


@pytest.mark.asyncio
async def test_update_returns_none_and_rolls_back():
    execute_result = Mock()
    execute_result.scalar_one_or_none = Mock(return_value=None)
    session = make_fake_session(execute_result=execute_result)
    repo = ClientRepository(session)
    tenant_id = uuid4()
    entity_id = uuid4()

    result = await repo.update(tenant_id, entity_id, {"field": "updated"})

    assert result is None
    session.execute.assert_awaited_once()
    session.rollback.assert_awaited_once()
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_commits_when_entity_found():
    tenant_id = uuid4()
    entity_id = uuid4()
    entity = SimpleNamespace(id=entity_id, tenant_id=tenant_id, field="updated")
    execute_result = Mock()
    execute_result.scalar_one_or_none = Mock(return_value=entity)
    session = make_fake_session(execute_result=execute_result)
    repo = ClientRepository(session)

    result = await repo.update(tenant_id, entity_id, {"field": "updated"})

    assert result is entity
    session.execute.assert_awaited_once()
    session.commit.assert_awaited_once()
    session.rollback.assert_not_awaited()


@pytest.mark.asyncio
async def test_mark_won_commits_and_returns_deal():
    deal = SimpleNamespace(status="won")
    execute_result = Mock()
    execute_result.scalar_one_or_none = Mock(return_value=deal)
    session = make_fake_session(execute_result=execute_result)
    repo = DealRepository(session)
    tenant_id = uuid4()
    deal_id = uuid4()

    result = await repo.mark_won(tenant_id, deal_id)

    assert result is deal
    assert result.status == "won"
    session.execute.assert_awaited_once()
    session.commit.assert_awaited_once()
    session.rollback.assert_not_awaited()


@pytest.mark.asyncio
async def test_mark_won_rolls_back_when_missing():
    execute_result = Mock()
    execute_result.scalar_one_or_none = Mock(return_value=None)
    session = make_fake_session(execute_result=execute_result)
    repo = DealRepository(session)
    tenant_id = uuid4()
    deal_id = uuid4()

    result = await repo.mark_won(tenant_id, deal_id)

    assert result is None
    session.execute.assert_awaited_once()
    session.rollback.assert_awaited_once()
    session.commit.assert_not_awaited()
