from __future__ import annotations

import shlex
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.engine import URL, make_url

from crm.app.config import settings


def _build_async_url(raw_url: str) -> tuple[URL, dict[str, Any]]:
    url = make_url(raw_url)
    query = dict(url.query)
    search_path_value = query.pop("search_path", None)
    options_value = query.get("options")
    search_path_from_options: str | None = None

    if options_value:
        tokens = shlex.split(options_value)
        filtered_tokens: list[str] = []
        idx = 0
        while idx < len(tokens):
            token = tokens[idx]
            if token == "-c" and idx + 1 < len(tokens):
                setting = tokens[idx + 1]
                if setting.startswith("search_path="):
                    search_path_from_options = setting.split("=", 1)[1]
                else:
                    filtered_tokens.extend([token, setting])
                idx += 2
                continue
            if token.startswith("-csearch_path="):
                search_path_from_options = token.split("=", 1)[1]
                idx += 1
                continue
            filtered_tokens.append(token)
            idx += 1

        if filtered_tokens:
            query["options"] = " ".join(filtered_tokens)
        else:
            query.pop("options", None)

    url = url.set(query=query or {})

    if url.drivername.startswith("postgresql+asyncpg"):
        async_url = url
    elif url.drivername.startswith("postgresql"):
        async_url = url.set(drivername="postgresql+asyncpg")
    else:
        raise ValueError("CRM service currently supports only PostgreSQL DSN")

    connect_args: dict[str, Any] = {}
    search_path: str | None = None
    if search_path_value is not None:
        if isinstance(search_path_value, (list, tuple)):
            search_path = search_path_value[0]
        else:
            search_path = search_path_value
    elif search_path_from_options is not None:
        search_path = search_path_from_options

    if search_path:
        connect_args = {"server_settings": {"search_path": search_path}}

    return async_url, connect_args


def get_async_database_config() -> tuple[URL, dict[str, Any]]:
    return _build_async_url(str(settings.database_url))


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _ensure_session_factory() -> async_sessionmaker[AsyncSession]:
    global _engine, _session_factory

    if _session_factory is None:
        database_url, engine_connect_args = get_async_database_config()
        _engine = create_async_engine(
            database_url,
            echo=False,
            future=True,
            pool_pre_ping=True,
            connect_args=engine_connect_args,
        )
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False, autoflush=False)

    return _session_factory


def AsyncSessionFactory() -> AsyncSession:
    """Return a new asynchronous session instance.

    Сессия создаётся лениво, чтобы модуль можно было импортировать без валидного
    соединения с базой данных. Настоящее подключение формируется только при первом
    обращении после инициализации окружения (например, в тестах).
    """

    session_factory = _ensure_session_factory()
    return session_factory()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionFactory() as session:
        yield session


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return _ensure_session_factory()


try:  # pragma: no cover - best effort eager initialisation
    _ensure_session_factory()
except ValueError:
    # Некорректный DSN. Инициализация произойдёт позже, когда окружение будет настроено.
    pass
