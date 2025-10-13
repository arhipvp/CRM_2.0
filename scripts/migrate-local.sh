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

run_notifications_migrations() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "[migrate-local] pnpm не найден, пропускаем миграции Notifications." >&2
    return 0
  fi

  echo "[migrate-local] Применяем миграции Notifications (TypeORM)..."
  pushd "$ROOT_DIR/backend/notifications" >/dev/null
  if [[ ! -d node_modules ]]; then
    pnpm install
  fi
  pnpm run migrations:run
  popd >/dev/null
}

run_crm_migrations
run_auth_migrations
run_notifications_migrations

echo "[migrate-local] Миграции CRM, Auth и Notifications применены."
