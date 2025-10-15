from __future__ import annotations

from datetime import datetime
from typing import Awaitable, Callable

from ..config import Settings
from ..models import BackupExecutionResult, BackupJob
from ..utils import run_command


def build_consul_snapshot_executor(settings: Settings) -> Callable[[BackupJob], Awaitable[BackupExecutionResult]]:
    async def executor(job: BackupJob) -> BackupExecutionResult:
        timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        filename = f"consul-snapshot-{timestamp}.snap"
        output_dir = settings.artifacts_dir
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / filename

        env = {"CONSUL_HTTP_ADDR": settings.consul_http_addr}
        if settings.consul_token:
            env["CONSUL_HTTP_TOKEN"] = settings.consul_token

        command = [settings.consul_binary, "snapshot", "save", str(output_path)]
        await run_command(command, env=env)

        metadata = {
            "job": job.name,
            "target": job.target,
            "mode": "consul_snapshot",
        }
        return BackupExecutionResult(artifact_path=output_path, artifact_name=filename, metadata=metadata)

    return executor
