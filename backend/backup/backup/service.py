from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Awaitable, Callable, Dict, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from .config import Settings
from .db import BackupRepository, RepositoryFactory
from .models import BackupExecutionResult, BackupJob, ExecutorNotRegisteredError, JobStatus, RunStatus
from .notifications import NotificationPayload, NotificationPublisher
from .storage import S3Storage

BackupExecutor = Callable[[BackupJob], Awaitable[BackupExecutionResult]]


class BackupService:
    def __init__(
        self,
        settings: Settings,
        repository_factory: RepositoryFactory,
        storage: S3Storage,
        publisher: NotificationPublisher,
    ) -> None:
        self._settings = settings
        self._repository_factory = repository_factory
        self._storage = storage
        self._publisher = publisher
        self._executors: Dict[str, BackupExecutor] = {}
        self._scheduler = AsyncIOScheduler(timezone=settings.timezone)
        self._repository: Optional[BackupRepository] = None
        self._started = False

    async def startup(self) -> None:
        if self._started:
            return
        self._repository = await self._repository_factory.create()
        await self._publisher.connect()
        if self._settings.scheduler.enabled:
            await self._load_jobs_into_scheduler()
            self._scheduler.start()
        self._started = True

    async def shutdown(self) -> None:
        if not self._started:
            return
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
        await self._publisher.close()
        await self._repository_factory.close()
        self._started = False

    def register_executor(self, target: str, executor: BackupExecutor) -> None:
        self._executors[target] = executor

    async def list_jobs(self) -> list[BackupJob]:
        return await self.repository.list_jobs()

    async def create_job(self, *, name: str, target: str, cron_expression: str, timezone: Optional[str] = None) -> BackupJob:
        tz = timezone or self._settings.timezone
        job = await self.repository.create_job(
            name=name,
            target=target,
            cron_expression=cron_expression,
            timezone=tz,
            status=JobStatus.enabled,
        )
        if self._settings.scheduler.enabled:
            self._add_job_to_scheduler(job)
        return job

    async def toggle_job(self, job_id: int, *, enabled: bool) -> BackupJob:
        status = JobStatus.enabled if enabled else JobStatus.disabled
        job = await self.repository.update_job_status(job_id, status)
        if enabled:
            if self._settings.scheduler.enabled:
                self._add_job_to_scheduler(job)
        else:
            if self._settings.scheduler.enabled:
                self._remove_job_from_scheduler(job)
        return job

    async def list_runs(self, job_id: int, limit: int = 20):
        await self.repository.get_job(job_id)
        return await self.repository.list_runs(job_id, limit)

    async def run_job(self, job_id: int, *, trigger: str = "manual") -> None:
        job = await self.repository.get_job(job_id)
        await self._execute_job(job, trigger)

    async def _load_jobs_into_scheduler(self) -> None:
        jobs = await self.repository.list_active_jobs()
        for job in jobs:
            self._add_job_to_scheduler(job)

    def _add_job_to_scheduler(self, job: BackupJob) -> None:
        if job.target not in self._executors:
            return
        self._scheduler.add_job(
            lambda job_id=job.id: asyncio.create_task(self._execute_scheduled(job_id)),
            CronTrigger.from_crontab(job.cron_expression, timezone=job.timezone),
            id=self._scheduler_job_id(job),
            replace_existing=True,
            coalesce=True,
            misfire_grace_time=300,
        )

    def _remove_job_from_scheduler(self, job: BackupJob) -> None:
        job_id = self._scheduler_job_id(job)
        if self._scheduler.get_job(job_id):
            self._scheduler.remove_job(job_id)

    async def _execute_scheduled(self, job_id: int) -> None:
        await self._execute_job(await self.repository.get_job(job_id), trigger="scheduler")

    async def _execute_job(self, job: BackupJob, *, trigger: str) -> None:
        executor = self._executors.get(job.target)
        if not executor:
            raise ExecutorNotRegisteredError(job.target)

        run = await self.repository.create_run(job.id, status=RunStatus.running)
        try:
            result = await executor(job)
            artifact_key = await self._storage.upload_file(
                result.artifact_path,
                metadata=result.metadata,
                suggested_name=result.artifact_name,
            )
            await self.repository.finish_run(
                run.id,
                status=RunStatus.success,
                artifact_key=artifact_key,
                log=result.extra_log,
            )
            await self._publisher.publish(
                NotificationPayload(
                    job_id=job.id,
                    run_id=run.id,
                    status=RunStatus.success.value,
                    artifact_key=artifact_key,
                    message=f"Задание '{job.name}' выполнено",
                    extra={"trigger": trigger},
                )
            )
        except Exception as exc:  # noqa: BLE001
            await self.repository.finish_run(
                run.id,
                status=RunStatus.failed,
                log=str(exc),
            )
            await self._publisher.publish(
                NotificationPayload(
                    job_id=job.id,
                    run_id=run.id,
                    status=RunStatus.failed.value,
                    artifact_key=None,
                    message=f"Задание '{job.name}' завершилось ошибкой",
                    extra={"trigger": trigger, "error": str(exc)},
                )
            )
            raise

    def _scheduler_job_id(self, job: BackupJob) -> str:
        return f"backup-job-{job.id}"

    @property
    def scheduler(self) -> AsyncIOScheduler:
        return self._scheduler

    @property
    def repository(self) -> BackupRepository:
        if not self._repository:
            raise RuntimeError("Репозиторий не инициализирован")
        return self._repository


@asynccontextmanager
async def backup_service_context(
    settings: Settings,
    repository_factory: RepositoryFactory,
    storage: S3Storage,
    publisher: NotificationPublisher,
):
    service = BackupService(settings, repository_factory, storage, publisher)
    await service.startup()
    try:
        yield service
    finally:
        await service.shutdown()
