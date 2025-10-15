from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from ..models import BackupJob, BackupJobRun, JobStatus, RunStatus


class JobCreate(BaseModel):
    name: str = Field(..., description="Человекочитаемое имя задания")
    target: str = Field(..., description="Тип бэкапа, на который указывает исполнитель")
    cron_expression: str = Field(..., description="CRON-выражение расписания")
    timezone: Optional[str] = Field(default=None, description="Необязательный часовой пояс")


class JobToggle(BaseModel):
    enabled: bool = Field(..., description="Флаг включения задания")


class JobResponse(BaseModel):
    id: int
    name: str
    target: str
    cron_expression: str
    timezone: str
    status: JobStatus
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_job(cls, job: BackupJob) -> "JobResponse":
        return cls(**job.__dict__)


class RunResponse(BaseModel):
    id: int
    job_id: int
    status: RunStatus
    started_at: datetime
    finished_at: Optional[datetime]
    artifact_key: Optional[str]
    log: Optional[str]

    @classmethod
    def from_run(cls, run: BackupJobRun) -> "RunResponse":
        return cls(**run.__dict__)


class HealthStatus(BaseModel):
    status: str = Field(..., description="Состояние сервиса")
