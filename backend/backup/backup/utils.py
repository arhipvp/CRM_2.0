from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Iterable, Mapping, MutableMapping, Optional

from .models import CommandExecutionError


async def run_command(
    command: Iterable[str],
    *,
    cwd: Optional[Path] = None,
    env: Optional[Mapping[str, str]] = None,
) -> tuple[str, str]:
    """Запускает внешнюю команду и возвращает stdout/stderr."""

    process_env: MutableMapping[str, str] = os.environ.copy()
    if env:
        process_env.update(env)

    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(cwd) if cwd else None,
        env=process_env,
    )
    stdout_bytes, stderr_bytes = await process.communicate()
    stdout = stdout_bytes.decode()
    stderr = stderr_bytes.decode()

    if process.returncode != 0:
        raise CommandExecutionError(list(command), process.returncode, stderr)

    return stdout, stderr
