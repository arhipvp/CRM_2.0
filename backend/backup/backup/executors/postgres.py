from __future__ import annotations

from datetime import datetime
from typing import Awaitable, Callable

from ..config import Settings
from ..models import BackupExecutionResult, BackupJob
from ..utils import run_command


def build_pg_dump_executor(settings: Settings) -> Callable[[BackupJob], Awaitable[BackupExecutionResult]]:
    async def executor(job: BackupJob) -> BackupExecutionResult:
        timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        filename = f"postgres-dump-{timestamp}.dump"
        output_dir = settings.artifacts_dir
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / filename

        command = [
            settings.pg_dump_path,
            f"--dbname={settings.postgres_backup_dsn}",
            "--format=custom",
            "--compress=9",
            f"--file={output_path}",
            "--no-owner",
            "--no-privileges",
            "--verbose",
        ]
        await run_command(command)

        metadata = {
            "job": job.name,
            "target": job.target,
            "mode": "pg_dump",
        }
        return BackupExecutionResult(artifact_path=output_path, artifact_name=filename, metadata=metadata)

    return executor


def build_pg_basebackup_executor(settings: Settings) -> Callable[[BackupJob], Awaitable[BackupExecutionResult]]:
    async def executor(job: BackupJob) -> BackupExecutionResult:
        timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        filename = f"postgres-basebackup-{timestamp}.tar"
        output_dir = settings.artifacts_dir
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / filename

        command = [
            settings.pg_basebackup_path,
            f"--dbname={settings.postgres_backup_dsn}",
            "--format=tar",
            f"--file={output_path}",
            "--progress",
            "--verbose",
        ]
        await run_command(command)

        metadata = {
            "job": job.name,
            "target": job.target,
            "mode": "pg_basebackup",
        }
        return BackupExecutionResult(artifact_path=output_path, artifact_name=filename, metadata=metadata)

    return executor
