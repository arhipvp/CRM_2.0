from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from crm.app.config import settings
from crm.infrastructure import models
from crm.infrastructure.db import get_async_database_config

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

database_url, engine_connect_args = get_async_database_config()

config.set_main_option(
    "sqlalchemy.url",
    database_url.render_as_string(hide_password=False),
)

target_metadata = [models.CRMBase.metadata, models.TasksBase.metadata]


def include_object(object, name, type_, reflected, compare_to):  # noqa: ANN001
    if type_ == "table" and object.schema not in {"crm", "tasks"}:
        return False
    return True


def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=engine_connect_args,
    )

    async def do_run_migrations() -> None:
        async with connectable.connect() as connection:
            await connection.run_sync(run_migrations)
        await connectable.dispose()

    asyncio.run(do_run_migrations())


def run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=True,
        include_object=include_object,
        version_table_schema="crm",
        version_table_column_length=128,
    )

    with context.begin_transaction():
        context.run_migrations()


run_migrations_online()
