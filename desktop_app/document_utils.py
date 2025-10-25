"""Утилиты для работы с документами сделок."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable, List

from config import DEAL_DOCUMENTS_ROOT
from logger import logger


def ensure_deal_folder(deal_id: str) -> Path:
    """Создать (при необходимости) папку для документов сделки."""
    folder = DEAL_DOCUMENTS_ROOT / deal_id
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def copy_files_to_deal_folder(deal_id: str, source_paths: Iterable[str]) -> List[str]:
    """Скопировать файлы в папку сделки и вернуть относительные пути."""
    stored_paths: List[str] = []
    destination = ensure_deal_folder(deal_id)

    for path in source_paths:
        if not path:
            continue
        source = Path(path).expanduser()
        if not source.exists():
            logger.warning("Файл %s не найден и не будет прикреплён", source)
            continue

        dest_name = source.name
        counter = 1
        target = destination / dest_name
        while target.exists():
            dest_name = f"{source.stem}_{counter}{source.suffix}"
            target = destination / dest_name
            counter += 1

        try:
            shutil.copy2(source, target)
        except OSError as exc:
            logger.error("Не удалось скопировать файл %s: %s", source, exc)
            continue

        relative = Path(deal_id) / dest_name
        stored_paths.append(relative.as_posix())

    return stored_paths


def resolve_deal_file(relative_path: str) -> Path:
    """Вернуть абсолютный путь к файлу сделки по относительному пути."""
    return DEAL_DOCUMENTS_ROOT / Path(relative_path)


def open_path(path: Path) -> None:
    """Открыть файл или папку в системном проводнике/ассоциированном приложении."""
    try:
        if sys.platform.startswith("win"):
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.run(["open", str(path)], check=False)
        else:
            subprocess.run(["xdg-open", str(path)], check=False)
    except Exception as exc:  # pragma: no cover - зависит от платформы
        logger.error("Не удалось открыть путь %s: %s", path, exc)


def open_deal_folder(deal_id: str) -> Path:
    """Открыть папку сделки и вернуть её путь."""
    folder = ensure_deal_folder(deal_id)
    open_path(folder)
    return folder


def open_deal_file(relative_path: str) -> Path:
    """Открыть файл сделки по относительному пути и вернуть абсолютный."""
    file_path = resolve_deal_file(relative_path)
    if not file_path.exists():
        raise FileNotFoundError(file_path)
    open_path(file_path)
    return file_path
