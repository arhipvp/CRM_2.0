import pytest
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from crm.infrastructure.repositories import BaseRepository, RepositoryError


class FakeModel:
    def __init__(self, tenant_id, **data):
        self.tenant_id = tenant_id
        for key, value in data.items():
            setattr(self, key, value)


class FakeRepository(BaseRepository[FakeModel]):
    model = FakeModel


def make_fake_session(commit_side_effect=None):
    session = Mock()
    session.add = Mock()
    session.commit = AsyncMock(side_effect=commit_side_effect)
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
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
