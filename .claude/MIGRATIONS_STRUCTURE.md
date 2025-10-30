# Структура миграций CRM 2.0

## 1. CRM (Python/Alembic)

**Расположение**: `backend/crm/migrations/`
**Файлов миграций**: 18
**Команда**: `poetry run alembic upgrade head`

Основные миграции:
- 2024031501_baseline.py - базовая схема
- 2025102601_add_tasks_module.py - модуль задач (последняя)
- 2025102604_migrate_crm_tasks_to_tasks_schema.py - миграция в отдельную схему

## 2. Auth (Spring Boot/Liquibase)

**Расположение**: `backend/auth/migrations/db/changelog/`
**Файлов миграций**: 1 changeset
**Команда**: `./gradlew update`

- 0001-init-auth-tables.yaml - инициализация пользователей и ролей

## 3. Documents (Node.js/TypeORM)

**Расположение**: `backend/documents/migrations/`
**Файлов миграций**: 6
**Команда**: `npx typeorm migration:run -d typeorm.config.ts`

Миграции:
- 1737043200000-init-documents-table.ts
- 1738886400000-add-deleted-at-to-documents.ts
- 1740201600000-create-folders-table.ts
- 1740801600000-create-permissions-sync-tasks.ts

## 4. Reports (Python/SQL)

**Расположение**: `backend/reports/migrations/`
**Файлов миграций**: 1
**Команда**: `psql "$REPORTS_DATABASE_URL" -f 001_create_deal_pipeline_summary.sql`

- 001_create_deal_pipeline_summary.sql - материализованное представление

## 5. Bootstrap скрипт (scripts/migrate-local.sh)

**Порядок**:
1. Auth (Liquibase): `./gradlew update`
2. CRM (Alembic): `poetry run alembic upgrade head` (с повторами)
3. Reports (psql): с параметризацией схем

**Требования**:
- .env файл с переменными DATABASE_URL
- Доступ к PostgreSQL, Redis
- Установлены: Poetry, JDK 21, psql, Node.js
