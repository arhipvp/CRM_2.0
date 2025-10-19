#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env ]]; then
  echo "[migrate-local] Файл .env не найден в корне репозитория. Скопируйте env.example и заполните значения." >&2
  exit 1
fi

# Загружаем переменные окружения из .env
set -a
nounset_was_set=0
if [[ $- == *u* ]]; then
  nounset_was_set=1
  set +u
fi
source .env
if (( nounset_was_set )); then
  set -u
fi
set +a

ROOT_DIR=$(pwd)

run_documents_migrations() {
  echo "[migrate-local] ��������� �������� Documents (TypeORM)..."
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "[migrate-local] pnpm �� ������. ���������� pnpm: https://pnpm.io/installation." >&2
    return 1
  fi

  pushd "$ROOT_DIR/backend/documents" >/dev/null

  local documents_db_url="${DOCUMENTS_DATABASE_URL:-postgresql://documents:documents@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-crm}?search_path=documents}"
  local admin_db_url="${DATABASE_URL:-postgresql://postgres:postgres@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-crm}}"

  pnpm install --frozen-lockfile >/dev/null

  DOCUMENTS_DATABASE_URL="${documents_db_url}" \
    DATABASE_URL="${admin_db_url}" \
    node - <<'NODE'
require('ts-node/register');
const { DocumentsDataSource } = require('./typeorm.config.ts');

(async () => {
  const dataSource = await DocumentsDataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

  popd >/dev/null
}

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

run_audit_migrations() {
  echo "[migrate-local] Применяем миграции Audit (Liquibase)..."
  pushd "$ROOT_DIR/backend/audit" >/dev/null
  if command -v gradle >/dev/null 2>&1; then
    gradle update
  elif [[ -x ./gradlew ]]; then
    ./gradlew update
  else
    echo "[migrate-local] Gradle не установлен и wrapper отсутствует. Установите Gradle 8+ и повторите." >&2
    exit 1
  fi
  popd >/dev/null
}

run_reports_migrations() {
  local migrations_dir="$ROOT_DIR/backend/reports/migrations"
  local migration_file="$migrations_dir/001_create_deal_pipeline_summary.sql"

  if [[ ! -f "$migration_file" ]]; then
    echo "[migrate-local] Файл миграции Reports не найден, пропускаем."
    return
  fi

  if ! command -v psql >/dev/null 2>&1; then
    echo "[migrate-local] psql не установлен, пропускаем миграции Reports." >&2
    return
  fi

  local reports_url="${REPORTS_DATABASE_URL:-}" 
  if [[ -z "$reports_url" ]]; then
    if [[ -n "${DATABASE_URL:-}" ]]; then
      reports_url="$DATABASE_URL"
    else
      echo "[migrate-local] REPORTS_DATABASE_URL или DATABASE_URL не заданы, пропускаем миграции Reports." >&2
      return
    fi
  fi

  echo "[migrate-local] Применяем миграции Reports (psql)..."
  PGPASSWORD="${REPORTS_DB_PASSWORD:-${POSTGRES_PASSWORD:-}}" \
    psql "$reports_url" \
    -v reports_schema="${REPORTS_SCHEMA:-reports}" \
    -v crm_schema="${REPORTS_CRM_SCHEMA:-crm}" \
    -f "$migration_file"
}

run_documents_migrations
run_crm_migrations
run_auth_migrations
run_audit_migrations
run_reports_migrations

echo "[migrate-local] Миграции CRM, Auth, Audit и Reports применены."
