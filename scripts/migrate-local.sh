#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env ]]; then
  echo "[migrate-local] Файл .env не найден в корне репозитория. Скопируйте env.example и заполните значения." >&2
  exit 1
fi

# Загружаем переменные окружения из .env
set -a
source .env
set +a

ROOT_DIR=$(pwd)

run_crm_migrations() {
  echo "[migrate-local] Применяем миграции CRM (Alembic)..."
  pushd "$ROOT_DIR/backend/crm" >/dev/null
  poetry run alembic upgrade head
  popd >/dev/null
}

run_auth_migrations() {
  echo "[migrate-local] Применяем миграции Auth (Liquibase)..."
  pushd "$ROOT_DIR/backend/auth" >/dev/null
  ./gradlew update
  popd >/dev/null
}

run_tasks_migrations() {
  echo "[migrate-local] Применяем миграции Tasks (TypeORM)..."
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "[migrate-local] pnpm не найден, пропускаем миграции Tasks. Установите pnpm и повторите."
    return 0
  fi
  pushd "$ROOT_DIR/backend/tasks" >/dev/null
  if [[ ! -d node_modules ]]; then
    echo "[migrate-local] node_modules отсутствует, выполняем pnpm install..."
    pnpm install --frozen-lockfile || { popd >/dev/null; return 1; }
  fi
  pnpm migration:run
  popd >/dev/null
}

run_crm_migrations
run_auth_migrations
run_tasks_migrations

echo "[migrate-local] Миграции CRM, Auth и Tasks применены."
