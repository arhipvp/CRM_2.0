from __future__ import annotations

from datetime import datetime
from typing import Awaitable, Callable
from urllib.parse import urlparse

from ..config import Settings
from ..models import BackupExecutionResult, BackupJob
from ..utils import run_command


def build_rabbitmq_export_executor(settings: Settings) -> Callable[[BackupJob], Awaitable[BackupExecutionResult]]:
    async def executor(job: BackupJob) -> BackupExecutionResult:
        timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        filename = f"rabbitmq-export-{timestamp}.json"
        output_dir = settings.artifacts_dir
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / filename

        url = urlparse(settings.rabbitmq_management_url)
        host = url.hostname or "localhost"
        port = url.port or (443 if url.scheme == "https" else 15672)

        command = [
            settings.rabbitmq_admin_binary,
            f"--host={host}",
            f"--port={port}",
            f"--username={settings.rabbitmq_admin_user}",
            f"--password={settings.rabbitmq_admin_password}",
            f"--vhost={settings.rabbitmq_vhost}",
            "export",
            str(output_path),
        ]
        if url.scheme == "https":
            command.append("--ssl")
        await run_command(command)

        metadata = {
            "job": job.name,
            "target": job.target,
            "mode": "rabbitmq_export",
        }
        return BackupExecutionResult(artifact_path=output_path, artifact_name=filename, metadata=metadata)

    return executor
