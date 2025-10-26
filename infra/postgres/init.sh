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
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${role}', '${password}');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = '${schema}') THEN
    EXECUTE format('CREATE SCHEMA %I AUTHORIZATION %I', '${schema}', '${role}');
  END IF;

  EXECUTE format('ALTER ROLE %I WITH PASSWORD %L', '${role}', '${password}');
  EXECUTE format('ALTER ROLE %I IN DATABASE %I SET search_path TO %I, public', '${role}', '${POSTGRES_DB}', '${schema}');
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', '${schema}', '${role}');
  EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I TO %I', '${schema}', '${role}');
  EXECUTE format('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I TO %I', '${schema}', '${role}');
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO %I', '${schema}', '${role}');
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO %I', '${schema}', '${role}');
END\$\$;
SQL
}

create_role AUTH_DB_USER AUTH_DB_PASSWORD auth
create_role CRM_DB_USER CRM_DB_PASSWORD crm
create_role DOCUMENTS_DB_USER DOCUMENTS_DB_PASSWORD documents
create_role BACKUP_DB_USER BACKUP_DB_PASSWORD backup
create_role REPORTS_DB_USER REPORTS_DB_PASSWORD reports


grant_database_privileges() {
  log "Назначаем привилегии CREATE на базе данных сервисным пользователям"
  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" <<'SQL'
DO $$
DECLARE
  role_name text;
  roles text[] := ARRAY[
    'auth', 'crm', 'documents', 'backup', 'reports'
  ];
BEGIN
  FOREACH role_name IN ARRAY roles LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT CREATE ON DATABASE %I TO %I', current_database(), role_name);
    END IF;
  END LOOP;
END$$;
SQL
}

ensure_tasks_schema() {
  log "Готовим схему tasks для модуля задач CRM"
  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" <<'SQL'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'tasks') THEN
      EXECUTE 'CREATE SCHEMA tasks AUTHORIZATION crm';
    ELSE
      EXECUTE 'ALTER SCHEMA tasks OWNER TO crm';
    END IF;

    EXECUTE 'GRANT USAGE, CREATE ON SCHEMA tasks TO crm';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE crm IN SCHEMA tasks GRANT ALL ON TABLES TO crm';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE crm IN SCHEMA tasks GRANT ALL ON SEQUENCES TO crm';
  END IF;
END$$;
SQL
}

grant_cross_schema_privileges() {
  log "Выдаём CRM доступ к схемам documents и auth"
  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" <<'SQL'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm')
     AND EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'documents') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA documents TO crm';
    EXECUTE 'GRANT SELECT, REFERENCES ON ALL TABLES IN SCHEMA documents TO crm';
    EXECUTE 'GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA documents TO crm';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA documents GRANT SELECT, REFERENCES ON TABLES TO crm';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA documents GRANT USAGE ON SEQUENCES TO crm';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm')
     AND EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA auth TO crm';
    EXECUTE 'GRANT SELECT, REFERENCES ON ALL TABLES IN SCHEMA auth TO crm';
    EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA auth TO crm';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT SELECT, REFERENCES ON TABLES TO crm';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT USAGE ON SEQUENCES TO crm';
  END IF;
END$$;
SQL
}


grant_database_privileges
ensure_tasks_schema
grant_cross_schema_privileges

log "Инициализация завершена"
