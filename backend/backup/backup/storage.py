from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Mapping, Optional

import boto3

from .config import Settings


class S3Storage:
    """Хранилище артефактов резервных копий."""

    def __init__(self, settings: Settings) -> None:
        session = boto3.session.Session()
        self._client = session.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region_name,
        )
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
