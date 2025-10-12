from __future__ import annotations

from celery import Celery

from crm.app.config import settings

celery_app = Celery("crm.deals")
celery_app.config_from_object(
    {
        "broker_url": settings.resolved_celery_broker,
        "result_backend": settings.resolved_celery_backend,
        "task_default_queue": settings.celery_default_queue,
        "task_routes": settings.celery_task_routes,
        "task_acks_late": True,
        "worker_prefetch_multiplier": 1,
        "task_default_retry_delay": settings.payments_retry_delay_ms / 1000,
        "imports": ("crm.app.tasks",),
    }
)
