from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..db import RepositoryFactory, check_database_health
from ..models import ExecutorNotRegisteredError, JobNotFoundError
from ..service import BackupService
from .schemas import HealthStatus, JobCreate, JobResponse, JobToggle, RunResponse

router = APIRouter()


def get_service(request: Request) -> BackupService:
    return request.app.state.backup_service


@router.get("/health", response_model=HealthStatus)
async def health_check(request: Request) -> HealthStatus:
    service: BackupService = request.app.state.backup_service
    repository_factory: RepositoryFactory = request.app.state.repository_factory
    await check_database_health(repository_factory.pool)
    return HealthStatus(status="ok")


@router.get("/jobs", response_model=list[JobResponse])
async def list_jobs(service: BackupService = Depends(get_service)) -> list[JobResponse]:
    jobs = await service.list_jobs()
    return [JobResponse.from_job(job) for job in jobs]


@router.post("/jobs", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(payload: JobCreate, service: BackupService = Depends(get_service)) -> JobResponse:
    job = await service.create_job(
        name=payload.name,
        target=payload.target,
        cron_expression=payload.cron_expression,
        timezone=payload.timezone,
    )
    return JobResponse.from_job(job)


@router.post("/jobs/{job_id}/toggle", response_model=JobResponse)
async def toggle_job(job_id: int, payload: JobToggle, service: BackupService = Depends(get_service)) -> JobResponse:
    try:
        job = await service.toggle_job(job_id, enabled=payload.enabled)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return JobResponse.from_job(job)


@router.post("/jobs/{job_id}/run", status_code=status.HTTP_202_ACCEPTED)
async def run_job(job_id: int, service: BackupService = Depends(get_service)) -> None:
    try:
        await service.run_job(job_id, trigger="manual")
    except JobNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ExecutorNotRegisteredError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/jobs/{job_id}/runs", response_model=list[RunResponse])
async def list_runs(job_id: int, service: BackupService = Depends(get_service)) -> list[RunResponse]:
    try:
        runs = await service.list_runs(job_id)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [RunResponse.from_run(run) for run in runs]
