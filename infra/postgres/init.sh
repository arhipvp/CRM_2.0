#!/usr/bin/env bash
set -euo pipefail

function log() {
  echo "[bootstrap] $*"
}

log "Инициализация дополнительных схем и ролей"

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" <<'SQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SQL

create_role() {
  local user_var=$1
  local pass_var=$2
  local schema=$3

  local role=${!user_var:-}
  local password=${!pass_var:-}

  if [[ -z "$role" || -z "$password" ]]; then
    log "Пропуск схемы ${schema}: не заданы переменные $user_var/$pass_var"
    return
  fi

  log "Обработка роли ${role} и схемы ${schema}"

  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" <<SQL
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${role}', '${password}');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = '${schema}') THEN
    EXECUTE format('CREATE SCHEMA %I AUTHORIZATION %I', '${schema}', '${role}');
  END IF;

  EXECUTE format('ALTER ROLE %I IN DATABASE %I SET search_path TO %I, public', '${role}', '${POSTGRES_DB}', '${schema}');
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', '${schema}', '${role}');
  EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I TO %I', '${schema}', '${role}');
  EXECUTE format('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I TO %I', '${schema}', '${role}');
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO %I', '${schema}', '${role}');
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO %I', '${schema}', '${role}');
END$$;
SQL
}

create_role AUTH_DB_USER AUTH_DB_PASSWORD auth
create_role CRM_DB_USER CRM_DB_PASSWORD crm
create_role PAYMENTS_DB_USER PAYMENTS_DB_PASSWORD payments
create_role DOCUMENTS_DB_USER DOCUMENTS_DB_PASSWORD documents
create_role TASKS_DB_USER TASKS_DB_PASSWORD tasks
create_role NOTIFICATIONS_DB_USER NOTIFICATIONS_DB_PASSWORD notifications
create_role AUDIT_DB_USER AUDIT_DB_PASSWORD audit
create_role BACKUP_DB_USER BACKUP_DB_PASSWORD backup

log "Инициализация завершена"
