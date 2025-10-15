from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime
from typing import AsyncIterator, Optional

from psycopg import AsyncConnection, AsyncCursor
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from .config import Settings
from .models import BackupJob, BackupJobRun, JobNotFoundError, JobStatus, RunStatus


class BackupRepository:
    """Хранилище заданий и запусков."""

    def __init__(self, pool: AsyncConnectionPool) -> None:
        self._pool = pool

    @asynccontextmanager
    async def cursor(self) -> AsyncIterator[AsyncCursor]:
        async with self._pool.connection() as conn:  # type: AsyncConnection
            async with conn.cursor(row_factory=dict_row) as cur:
                yield cur

    async def ensure_schema(self) -> None:
        async with self.cursor() as cur:
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS backup_jobs (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    target TEXT NOT NULL,
                    cron_expression TEXT NOT NULL,
                    timezone TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'enabled',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS backup_job_runs (
                    id BIGSERIAL PRIMARY KEY,
                    job_id INTEGER NOT NULL REFERENCES backup_jobs(id) ON DELETE CASCADE,
                    status TEXT NOT NULL,
                    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    finished_at TIMESTAMPTZ,
                    artifact_key TEXT,
                    log TEXT
                );
                """
            )

    async def list_jobs(self) -> list[BackupJob]:
        async with self.cursor() as cur:
            await cur.execute(
                """
                SELECT id, name, target, cron_expression, timezone, status, created_at, updated_at
                  FROM backup_jobs
                 ORDER BY id
                """
            )
            rows = await cur.fetchall()
        return [self._row_to_job(row) for row in rows]

    async def get_job(self, job_id: int) -> BackupJob:
        async with self.cursor() as cur:
            await cur.execute(
                """
                SELECT id, name, target, cron_expression, timezone, status, created_at, updated_at
                  FROM backup_jobs
                 WHERE id = %s
                """,
                (job_id,),
            )
            row = await cur.fetchone()
        if not row:
            raise JobNotFoundError(job_id)
        return self._row_to_job(row)

    async def create_job(
        self,
        *,
        name: str,
        target: str,
        cron_expression: str,
        timezone: str,
        status: JobStatus = JobStatus.enabled,
    ) -> BackupJob:
        async with self.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO backup_jobs(name, target, cron_expression, timezone, status)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, name, target, cron_expression, timezone, status, created_at, updated_at
                """,
                (name, target, cron_expression, timezone, status.value),
            )
            row = await cur.fetchone()
        return self._row_to_job(row)

    async def update_job_status(self, job_id: int, status: JobStatus) -> BackupJob:
        async with self.cursor() as cur:
            await cur.execute(
                """
                UPDATE backup_jobs
                   SET status = %s,
                       updated_at = NOW()
                 WHERE id = %s
                RETURNING id, name, target, cron_expression, timezone, status, created_at, updated_at
                """,
                (status.value, job_id),
            )
            row = await cur.fetchone()
        if not row:
            raise JobNotFoundError(job_id)
        return self._row_to_job(row)

    async def create_run(
        self,
        job_id: int,
        *,
        status: RunStatus,
        started_at: Optional[datetime] = None,
    ) -> BackupJobRun:
        async with self.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO backup_job_runs(job_id, status, started_at)
                VALUES (%s, %s, COALESCE(%s, NOW()))
                RETURNING id, job_id, status, started_at, finished_at, artifact_key, log
                """,
                (job_id, status.value, started_at),
            )
            row = await cur.fetchone()
        return self._row_to_run(row)

    async def finish_run(
        self,
        run_id: int,
        *,
        status: RunStatus,
        artifact_key: Optional[str] = None,
        log: Optional[str] = None,
    ) -> BackupJobRun:
        async with self.cursor() as cur:
            await cur.execute(
                """
                UPDATE backup_job_runs
                   SET status = %s,
                       finished_at = NOW(),
                       artifact_key = %s,
                       log = %s
                 WHERE id = %s
                RETURNING id, job_id, status, started_at, finished_at, artifact_key, log
                """,
                (status.value, artifact_key, log, run_id),
            )
            row = await cur.fetchone()
        return self._row_to_run(row)

    async def list_runs(self, job_id: int, limit: int = 20) -> list[BackupJobRun]:
        async with self.cursor() as cur:
            await cur.execute(
                """
                SELECT id, job_id, status, started_at, finished_at, artifact_key, log
                  FROM backup_job_runs
                 WHERE job_id = %s
                 ORDER BY started_at DESC
                 LIMIT %s
                """,
                (job_id, limit),
            )
            rows = await cur.fetchall()
        return [self._row_to_run(row) for row in rows]

    async def list_active_jobs(self) -> list[BackupJob]:
        async with self.cursor() as cur:
            await cur.execute(
                """
                SELECT id, name, target, cron_expression, timezone, status, created_at, updated_at
                  FROM backup_jobs
                 WHERE status = 'enabled'
                """
            )
            rows = await cur.fetchall()
        return [self._row_to_job(row) for row in rows]

    @staticmethod
    def _row_to_job(row: dict) -> BackupJob:
        return BackupJob(
            id=row["id"],
            name=row["name"],
            target=row["target"],
            cron_expression=row["cron_expression"],
            timezone=row["timezone"],
            status=JobStatus(row["status"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    @staticmethod
    def _row_to_run(row: dict) -> BackupJobRun:
        return BackupJobRun(
            id=row["id"],
            job_id=row["job_id"],
            status=RunStatus(row["status"]),
            started_at=row["started_at"],
            finished_at=row["finished_at"],
            artifact_key=row["artifact_key"],
            log=row["log"],
        )


class RepositoryFactory:
    """Создаёт пул соединений и репозиторий."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._pool: Optional[AsyncConnectionPool] = None

    async def create(self) -> BackupRepository:
        if self._pool is None:
            self._pool = AsyncConnectionPool(self._settings.database_url, open=False)
            await self._pool.open()
        repo = BackupRepository(self._pool)
        await repo.ensure_schema()
        return repo

    async def close(self) -> None:
        if self._pool:
            await self._pool.close()
            self._pool = None

    @property
    def pool(self) -> AsyncConnectionPool:
        if not self._pool:
            raise RuntimeError("Пул соединений не инициализирован")
        return self._pool


async def check_database_health(pool: AsyncConnectionPool) -> None:
    async with pool.connection() as conn:  # type: AsyncConnection
        async with conn.cursor() as cur:
            await cur.execute("SELECT 1")
            await cur.fetchone()
