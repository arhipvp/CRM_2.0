# syntax=docker/dockerfile:1.5
ARG PYTHON_IMAGE=python:3.11-slim

FROM ${PYTHON_IMAGE} AS base
ENV POETRY_VERSION=1.8.4 \
    POETRY_HOME=/opt/poetry \
    POETRY_NO_INTERACTION=1 \
    PIP_NO_CACHE_DIR=1
ENV POETRY_VIRTUALENVS_CREATE=0 \
    POETRY_VIRTUALENVS_IN_PROJECT=0
ENV PATH="${POETRY_HOME}/bin:${PATH}"
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && curl -sSL https://install.python-poetry.org | python3 - \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
ARG SERVICE_PATH
COPY ${SERVICE_PATH}/pyproject.toml ./pyproject.toml
COPY ${SERVICE_PATH}/poetry.lock ./poetry.lock
RUN poetry config virtualenvs.create false \
    && poetry install --no-ansi --without dev --no-root

FROM base AS build
ARG SERVICE_PATH
COPY ${SERVICE_PATH}/pyproject.toml ./pyproject.toml
COPY ${SERVICE_PATH}/poetry.lock ./poetry.lock
COPY --from=deps /app /app
COPY ${SERVICE_PATH}/ ./
RUN poetry config virtualenvs.create false \
    && poetry install --no-ansi --without dev

FROM build AS runtime
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY --from=build /app /app
RUN poetry install --no-ansi --without dev
CMD ["poetry", "run", "crm-api"]
