from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, Optional


class JobStatus(str, Enum):
    enabled = "enabled"
    disabled = "disabled"


class RunStatus(str, Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"


@dataclass(slots=True)
class BackupJob:
    id: int
    name: str
    target: str
    cron_expression: str
    timezone: str
    status: JobStatus
    created_at: datetime
    updated_at: datetime


@dataclass(slots=True)
class BackupJobRun:
    id: int
    job_id: int
    status: RunStatus
    started_at: datetime
    finished_at: Optional[datetime]
    artifact_key: Optional[str]
    log: Optional[str]


@dataclass(slots=True)
class BackupExecutionResult:
    artifact_path: Path
    artifact_name: str
    metadata: Dict[str, str]
    extra_log: Optional[str] = None


class BackupError(RuntimeError):
    """Базовое исключение сервиса резервного копирования."""


class CommandExecutionError(BackupError):
    def __init__(self, command: list[str], returncode: int, stderr: str) -> None:
        self.command = command
        self.returncode = returncode
        self.stderr = stderr
        super().__init__(f"Команда {' '.join(command)} завершилась с кодом {returncode}: {stderr}")


class JobNotFoundError(BackupError):
    def __init__(self, job_id: int) -> None:
        super().__init__(f"Задание с идентификатором {job_id} не найдено")
        self.job_id = job_id


class ExecutorNotRegisteredError(BackupError):
    def __init__(self, target: str) -> None:
        super().__init__(f"Не найден исполнитель для цели '{target}'")
        self.target = target


class HealthCheckError(BackupError):
    def __init__(self, details: Dict[str, Any]) -> None:
        self.details = details
        super().__init__("Одна или несколько проверок здоровья завершились ошибкой")
