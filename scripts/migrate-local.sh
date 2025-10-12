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

run_crm_migrations
run_auth_migrations

echo "[migrate-local] Миграции CRM и Auth применены."
