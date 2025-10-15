from pathlib import Path

import aio_pika
import boto3
import docker
import pytest
from httpx import ASGITransport, AsyncClient
from moto import mock_s3
from testcontainers.postgres import PostgresContainer
from testcontainers.rabbitmq import RabbitMqContainer

from backup.config import SchedulerSettings, Settings
from backup.main import create_app
from backup.models import BackupExecutionResult, RunStatus
from backup.service import BackupService
from backup.db import RepositoryFactory
from backup.storage import S3Storage
from backup.notifications import NotificationPublisher


@pytest.fixture(scope="session")
def postgres_container() -> PostgresContainer:
    try:
        client = docker.from_env()
        client.ping()
        client.close()
    except Exception as exc:  # pragma: no cover - infra check
        pytest.skip(f"Docker недоступен для Testcontainers: {exc}")
    with PostgresContainer("postgres:15-alpine") as container:
        container.start()
        yield container


@pytest.fixture(scope="session")
def rabbitmq_container() -> RabbitMqContainer:
    try:
        client = docker.from_env()
        client.ping()
        client.close()
    except Exception as exc:  # pragma: no cover - infra check
        pytest.skip(f"Docker недоступен для Testcontainers: {exc}")
    with RabbitMqContainer("rabbitmq:3.12-management") as container:
        container.start()
        yield container


@pytest.fixture
def test_settings(tmp_path: Path, postgres_container: PostgresContainer, rabbitmq_container: RabbitMqContainer) -> Settings:
    pg_url = postgres_container.get_connection_url()
    rabbit_host = rabbitmq_container.get_container_host_ip()
    amqp_port = rabbitmq_container.get_exposed_port(5672)
    http_port = rabbitmq_container.get_exposed_port(15672)
    return Settings(
        database_url=pg_url,
        s3_endpoint_url=None,
        s3_region_name="us-east-1",
        s3_access_key="test",
        s3_secret_key="test",
        s3_bucket="backups-test",
        rabbitmq_url=f"amqp://guest:guest@{rabbit_host}:{amqp_port}/",
        notification_exchange="backup.notifications",
        notification_routing_key="jobs",
        postgres_backup_dsn=pg_url,
        consul_http_addr="http://127.0.0.1:8500",
        rabbitmq_management_url=f"http://{rabbit_host}:{http_port}",
        rabbitmq_admin_user="guest",
        rabbitmq_admin_password="guest",
        rabbitmq_vhost="/",
        redis_host="localhost",
        redis_port=6379,
        scheduler=SchedulerSettings(enabled=False, poll_interval_seconds=60),
        artifacts_dir=tmp_path / "artifacts",
    )


@pytest.mark.asyncio
@mock_s3
async def test_health_endpoint_returns_ok(test_settings: Settings) -> None:
    s3_client = boto3.client(
        "s3",
        endpoint_url=test_settings.s3_endpoint_url,
        aws_access_key_id=test_settings.s3_access_key,
        aws_secret_access_key=test_settings.s3_secret_key,
        region_name=test_settings.s3_region_name,
    )
    s3_client.create_bucket(Bucket=test_settings.s3_bucket)

    app = create_app(test_settings)
    transport = ASGITransport(app=app, lifespan="on")
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
@mock_s3
async def test_manual_job_execution_uploads_to_s3_and_publishes_event(test_settings: Settings) -> None:
    s3_client = boto3.client(
        "s3",
        endpoint_url=test_settings.s3_endpoint_url,
        aws_access_key_id=test_settings.s3_access_key,
        aws_secret_access_key=test_settings.s3_secret_key,
        region_name=test_settings.s3_region_name,
    )
    s3_client.create_bucket(Bucket=test_settings.s3_bucket)

    repository_factory = RepositoryFactory(test_settings)
    storage = S3Storage(test_settings)
    publisher = NotificationPublisher(test_settings)
    service = BackupService(test_settings, repository_factory, storage, publisher)

    async def fake_executor(job):
        artifacts_dir = test_settings.artifacts_dir
        artifacts_dir.mkdir(parents=True, exist_ok=True)
        path = artifacts_dir / f"job-{job.id}.txt"
        path.write_text("ok", encoding="utf-8")
        return BackupExecutionResult(
            artifact_path=path,
            artifact_name=path.name,
            metadata={"mode": "fake"},
            extra_log="completed",
        )

    service.register_executor("test.fake", fake_executor)
    await service.startup()

    connection = await aio_pika.connect_robust(test_settings.rabbitmq_url)
    channel = await connection.channel()
    queue = await channel.declare_queue(exclusive=True)
    await queue.bind(test_settings.notification_exchange, routing_key=test_settings.notification_routing_key)

    try:
        job = await service.create_job(name="Fake job", target="test.fake", cron_expression="*/5 * * * *")
        await service.run_job(job.id, trigger="manual")

        runs = await service.list_runs(job.id)
        assert len(runs) == 1
        assert runs[0].status == RunStatus.success
        assert runs[0].artifact_key is not None
        assert runs[0].log == "completed"

        objects = s3_client.list_objects_v2(Bucket=test_settings.s3_bucket)
        assert objects.get("KeyCount", 0) == 1

        message = await queue.get(timeout=5)
        assert message is not None
        body = message.body.decode("utf-8")
        assert str(job.id) in body
        assert RunStatus.success.value in body
        await message.ack()
    finally:
        await connection.close()
        await service.shutdown()
