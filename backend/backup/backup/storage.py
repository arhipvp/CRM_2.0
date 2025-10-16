from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Mapping, Optional, Protocol, runtime_checkable

import shutil

try:
    import boto3
except ModuleNotFoundError:  # pragma: no cover - зависит от окружения
    boto3 = None

from .config import Settings


@runtime_checkable
class Storage(Protocol):
    async def upload_file(
        self,
        file_path: Path,
        *,
        metadata: Optional[Mapping[str, str]] = None,
        suggested_name: Optional[str] = None,
    ) -> str:
        """Загружает файл и возвращает ключ артефакта."""


class S3Storage:
    """Хранилище артефактов резервных копий."""

    def __init__(self, settings: Settings) -> None:
        if boto3 is None:  # pragma: no cover - защитный код для сред без boto3
            raise RuntimeError("boto3 недоступен, S3Storage не может быть создан")
        session = boto3.session.Session()

        endpoint_url = settings.s3_endpoint_url
        if isinstance(endpoint_url, str):
            endpoint_url = endpoint_url.strip() or None

        client_kwargs = dict(
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region_name,
        )
        if endpoint_url is not None:
            client_kwargs["endpoint_url"] = endpoint_url

        self._client = session.client("s3", **client_kwargs)
        self._bucket = settings.s3_bucket
        self._prefix = settings.s3_prefix.rstrip("/")

    async def upload_file(
        self,
        file_path: Path,
        *,
        metadata: Optional[Mapping[str, str]] = None,
        suggested_name: Optional[str] = None,
    ) -> str:
        """Загружает файл в бакет и возвращает ключ."""

        key = self._build_key(file_path, suggested_name)
        extra_args = {"Metadata": dict(metadata or {})}
        await asyncio.to_thread(self._client.upload_file, str(file_path), self._bucket, key, ExtraArgs=extra_args)
        return key

    def _build_key(self, file_path: Path, suggested_name: Optional[str]) -> str:
        filename = suggested_name or file_path.name
        timestamp = datetime.utcnow().strftime("%Y/%m/%d")
        return f"{self._prefix}/{timestamp}/{filename}"


class DummyStorage:
    """Простое хранилище, складывающее артефакты локально."""

    def __init__(self, settings: Settings) -> None:
        self._artifacts_dir = settings.artifacts_dir
        self._prefix = settings.s3_prefix.rstrip("/")

    async def upload_file(
        self,
        file_path: Path,
        *,
        metadata: Optional[Mapping[str, str]] = None,  # noqa: ARG002 - совместимость интерфейса
        suggested_name: Optional[str] = None,
    ) -> str:
        key = self._build_key(file_path, suggested_name)
        destination = self._artifacts_dir / key
        await asyncio.to_thread(self._copy_file, file_path, destination)
        return key

    @staticmethod
    def _copy_file(src: Path, dst: Path) -> None:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    def _build_key(self, file_path: Path, suggested_name: Optional[str]) -> str:
        filename = suggested_name or file_path.name
        timestamp = datetime.utcnow().strftime("%Y/%m/%d")
        return f"{self._prefix}/{timestamp}/{filename}"


def build_storage(settings: Settings) -> Storage:
    required_params = ("s3_bucket", "s3_access_key", "s3_secret_key")
    missing = [
        name for name in required_params if not _is_filled(getattr(settings, name, None))
    ]

    if missing:
        return DummyStorage(settings)

    return S3Storage(settings)


def _is_filled(value: Optional[str]) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    return True


__all__ = ["Storage", "S3Storage", "DummyStorage", "build_storage"]
