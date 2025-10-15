from __future__ import annotations

import asyncio
import shutil
import tarfile
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Awaitable, Callable, List, Optional

from ..config import Settings
from ..models import BackupExecutionResult, BackupJob
from ..utils import run_command


def _redis_uri(settings: Settings) -> str:
    scheme = "rediss" if settings.redis_use_tls else "redis"
    auth = ""
    if settings.redis_username and settings.redis_password:
        auth = f"{settings.redis_username}:{settings.redis_password}@"
    elif settings.redis_password:
        auth = f":{settings.redis_password}@"
    return f"{scheme}://{auth}{settings.redis_host}:{settings.redis_port}"


def build_redis_backup_executor(settings: Settings) -> Callable[[BackupJob], Awaitable[BackupExecutionResult]]:
    async def executor(job: BackupJob) -> BackupExecutionResult:
        timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        filename = f"redis-backup-{timestamp}.tar.gz"
        output_dir = settings.artifacts_dir
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / filename

        uri = _redis_uri(settings)
        base_command: List[str] = [settings.redis_cli_binary, "-u", uri]

        async with _temporary_directory() as tmpdir:
            rdb_path = tmpdir / "dump.rdb"
            await run_command(base_command + ["--rdb", str(rdb_path)])

            aof_path: Optional[Path] = None
            if settings.redis_data_dir:
                await run_command(base_command + ["BGREWRITEAOF"])
                candidate = settings.redis_data_dir / "appendonly.aof"
                if candidate.exists():
                    aof_tmp = tmpdir / "appendonly.aof"
                    await asyncio.to_thread(shutil.copy2, candidate, aof_tmp)
                    aof_path = aof_tmp

            with tarfile.open(output_path, "w:gz") as tar:
                tar.add(rdb_path, arcname="dump.rdb")
                if aof_path:
                    tar.add(aof_path, arcname="appendonly.aof")

        metadata = {
            "job": job.name,
            "target": job.target,
            "mode": "redis_snapshot",
        }
        return BackupExecutionResult(artifact_path=output_path, artifact_name=filename, metadata=metadata)

    return executor


@asynccontextmanager
def _temporary_directory():
    tmp_dir = tempfile.TemporaryDirectory()
    try:
        yield Path(tmp_dir.name)
    finally:
        tmp_dir.cleanup()
