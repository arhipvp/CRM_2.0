from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from crm.domain import schemas
from crm.domain.services import PermissionSyncError, PermissionSyncService


@pytest.fixture
def permissions_payload() -> schemas.SyncPermissionsDto:
    return schemas.SyncPermissionsDto(
        owner_type="deal",
        owner_id=uuid4(),
        users=[
            schemas.SyncPermissionsUser(user_id=uuid4(), role="viewer"),
            schemas.SyncPermissionsUser(user_id=uuid4(), role="editor"),
        ],
    )


@pytest.mark.asyncio
async def test_sync_permissions_enqueues_job(permissions_payload):
    job_id = uuid4()
    repository = MagicMock()
    repository.create_job = AsyncMock(return_value=MagicMock(id=job_id, status="queued"))
    repository.mark_failed = AsyncMock()
    queue = AsyncMock()
    queue.enqueue = AsyncMock()
    service = PermissionSyncService(repository, queue, "permissions:sync")

    tenant_id = uuid4()
    result = await service.sync_permissions(tenant_id, permissions_payload)

    assert result.job_id == job_id
    assert result.status == "queued"
    queue.enqueue.assert_awaited_once()
    repository.mark_failed.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_permissions_mark_failed_on_error(permissions_payload):
    job_id = uuid4()
    repository = MagicMock()
    repository.create_job = AsyncMock(return_value=MagicMock(id=job_id, status="queued"))
    repository.mark_failed = AsyncMock()
    queue = AsyncMock()
    queue.enqueue = AsyncMock(side_effect=RuntimeError("redis_down"))
    service = PermissionSyncService(repository, queue, "permissions:sync")

    with pytest.raises(PermissionSyncError):
        await service.sync_permissions(uuid4(), permissions_payload)

    repository.mark_failed.assert_awaited_once_with(job_id, "redis_down")


def test_sync_permissions_dto_requires_users():
    with pytest.raises(ValidationError):
        schemas.SyncPermissionsDto(owner_type="deal", owner_id=uuid4(), users=[])


def test_sync_permissions_dto_requires_unique_user_ids():
    user_id = uuid4()
    with pytest.raises(ValidationError):
        schemas.SyncPermissionsDto(
            owner_type="deal",
            owner_id=uuid4(),
            users=[
                schemas.SyncPermissionsUser(user_id=user_id, role="viewer"),
                schemas.SyncPermissionsUser(user_id=user_id, role="editor"),
            ],
        )
