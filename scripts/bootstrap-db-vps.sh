#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_ENV_FILE="$REPO_ROOT/.env"

ENV_FILE="$DEFAULT_ENV_FILE"
ADMIN_DB="postgres"

log() {
  local level="$1"; shift
  printf '[%s] [%s] %s\n' "$SCRIPT_NAME" "$level" "$*"
}

usage() {
  cat <<USAGE
Использование: $SCRIPT_NAME [--env-file PATH] [--admin-db NAME]

Параметры:
  --env-file PATH  Путь к .env (по умолчанию $DEFAULT_ENV_FILE)
  --admin-db NAME  Имя базы данных для административного подключения (по умолчанию postgres)
  -h, --help       Показать справку
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      shift
      [[ $# -gt 0 ]] || { log ERROR "Отсутствует значение для --env-file"; exit 1; }
      ENV_FILE="$1"
      ;;
    --env-file=*)
      ENV_FILE="${1#*=}"
      ;;
    --admin-db)
      shift
      [[ $# -gt 0 ]] || { log ERROR "Отсутствует значение для --admin-db"; exit 1; }
      ADMIN_DB="$1"
      ;;
    --admin-db=*)
      ADMIN_DB="${1#*=}"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log ERROR "Неизвестный аргумент: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ ! -f "$ENV_FILE" ]]; then
  log ERROR "Файл окружения '$ENV_FILE' не найден."
  exit 1
fi

log INFO "Загрузка переменных из $ENV_FILE"
set -a
was_nounset_enabled=false
if [[ $- == *u* ]]; then
  was_nounset_enabled=true
  set +u
fi
# shellcheck disable=SC1090
source "$ENV_FILE"
if [[ $was_nounset_enabled == true ]]; then
  set -u
fi
set +a

: "${POSTGRES_HOST:?Переменная POSTGRES_HOST не задана}"
: "${POSTGRES_PORT:?Переменная POSTGRES_PORT не задана}"
: "${POSTGRES_USER:?Переменная POSTGRES_USER не задана}"
: "${POSTGRES_PASSWORD:?Переменная POSTGRES_PASSWORD не задана}"
: "${POSTGRES_DB:?Переменная POSTGRES_DB не задана}"

declare -a ROLE_DEFINITIONS=(
  "AUTH_DB_USER AUTH_DB_PASSWORD auth"
  "CRM_DB_USER CRM_DB_PASSWORD crm"
  "DOCUMENTS_DB_USER DOCUMENTS_DB_PASSWORD documents"
  "TASKS_DB_USER TASKS_DB_PASSWORD tasks"
  "NOTIFICATIONS_DB_USER NOTIFICATIONS_DB_PASSWORD notifications"
  "REPORTS_DB_USER REPORTS_DB_PASSWORD reports"
  "AUDIT_DB_USER AUDIT_DB_PASSWORD audit"
  "BACKUP_DB_USER BACKUP_DB_PASSWORD backup"
)

find_psql() {
  if command -v psql >/dev/null 2>&1; then
    local cmd
    cmd="$(command -v psql)"
    "$cmd" --version >/dev/null 2>&1 || return 1
    printf '%s\n' "$cmd"
    return 0
  fi
  return 1
}

PSQL_CMD="$(find_psql)"
if [[ -z "$PSQL_CMD" ]]; then
  log ERROR "psql не найден. Установите клиент PostgreSQL и повторите попытку."
  exit 1
fi

log INFO "Используется $($PSQL_CMD --version | head -n1)"

run_psql() {
  local dbname="$1"
  shift
  PGPASSWORD="$POSTGRES_PASSWORD" "$PSQL_CMD" \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -v ON_ERROR_STOP=1 \
    -d "$dbname" \
    "$@"
}

create_database() {
  local dbname="$1"
  log INFO "Проверка базы данных $dbname"
  run_psql "$ADMIN_DB" --set db="$dbname" <<'SQL'
SELECT format('CREATE DATABASE %I', :'db')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db');
\gexec
SQL
}

create_extension() {
  local dbname="$1"
  log INFO "Создание расширений в базе $dbname"
  run_psql "$dbname" <<'SQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SQL
}

configure_role() {
  local dbname="$1"
  local role="$2"
  local password="$3"
  local schema="$4"

  if [[ -z "$role" || -z "$password" ]]; then
    log WARN "Пропуск схемы $schema: не заданы переменные для пользователя"
    return
  fi

  log INFO "Настройка роли $role и схемы $schema"
  run_psql "$dbname" --set role="$role" --set password="$password" --set schema="$schema" --set db="$dbname" <<'SQL'
SELECT set_config('bootstrap.role', :'role', false);
SELECT set_config('bootstrap.password', :'password', false);
SELECT set_config('bootstrap.schema', :'schema', false);
SELECT set_config('bootstrap.db', :'db', false);
DO $$
DECLARE
  target_role text := current_setting('bootstrap.role');
  target_password text := current_setting('bootstrap.password');
  target_schema text := current_setting('bootstrap.schema');
  target_db text := current_setting('bootstrap.db');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', target_role, target_password);
  ELSE
    EXECUTE format('ALTER ROLE %I PASSWORD %L', target_role, target_password);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = target_schema) THEN
    EXECUTE format('CREATE SCHEMA %I AUTHORIZATION %I', target_schema, target_role);
  END IF;

  EXECUTE format('ALTER ROLE %I IN DATABASE %I SET search_path TO %I, public', target_role, target_db, target_schema);
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', target_schema, target_role);
  EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I TO %I', target_schema, target_role);
  EXECUTE format('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I TO %I', target_schema, target_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO %I', target_schema, target_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO %I', target_schema, target_role);
END
$$;
SQL
}

main() {
  create_database "$POSTGRES_DB"
  create_extension "$POSTGRES_DB"

  local definition
  for definition in "${ROLE_DEFINITIONS[@]}"; do
    IFS=' ' read -r user_var pass_var schema <<<"$definition"
    local user_value="${!user_var:-}"
    local pass_value="${!pass_var:-}"
    configure_role "$POSTGRES_DB" "$user_value" "$pass_value" "$schema"
  done

  log INFO "Настройка завершена"
}

main "$@"
