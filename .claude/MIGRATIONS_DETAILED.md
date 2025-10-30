# Детальный анализ структуры миграций CRM 2.0

Дата анализа: 30.10.2025

## 1. CRM (Python/Alembic)

### Расположение и структура
- Директория: backend/crm/migrations/
- Конфиг: env.py (асинхронная конфигурация Alembic)
- Версии: versions/ (18 файлов миграций)

### Миграции (в хронологическом порядке)
1. 2024031501_baseline.py - Базовая схема (clients, deals, policies)
2. 2024031502_update_alembic_version_length.py
3. 2024052801_add_next_review_at_to_deals.py
4. 2024060101_add_permission_sync_jobs.py
5. 2024061501_add_payments_module.py
6. 2024062001_add_calculations.py
7. 2024062001_add_deal_journal.py
8. 2024062401_add_policy_documents.py
9. 2024070101_add_payments_foreign_keys.py
10. 2024071801_remove_deal_value.py
11. 2024072201_allow_null_owner_in_deals.py
12. 2024072801_add_notifications.py
13. 2025102501_remove_tenant_id.py
14. 2025102601_add_tasks_module.py
15. 2025102602_add_premium_to_policies.py
16. 2025102602_allow_null_owner_in_clients.py
17. 2025102603_allow_null_owner_in_clients.py (дубль)
18. 2025102604_migrate_crm_tasks_to_tasks_schema.py

### Команды
```bash
cd backend/crm
poetry run alembic upgrade head        # Применить все
poetry run alembic downgrade -1        # Откатить последнюю
poetry run alembic revision -m "name"  # Создать новую
```

## 2. Auth (Spring Boot/Liquibase)

### Расположение и структура
- Директория: backend/auth/migrations/
- Master changelog: db/changelog/db.changelog-master.yaml
- Changesets: db/changelog/changesets/0001-init-auth-tables.yaml

### Миграции
- 1 changeset: 0001-init-auth-tables.yaml (users, roles, user_roles)

### Команды
```bash
cd backend/auth
./gradlew update        # Применить миграции
./gradlew dbStatus      # Статус
./gradlew rollback ...  # Откатить
```

## 3. Documents (Node.js/TypeORM)

### Расположение и структура
- Директория: backend/documents/migrations/
- Конфиг: typeorm.config.ts
- Таблица версий: documents_migrations

### Миграции (6 файлов)
- 1737043200000-init-documents-table.ts (schema, documents table)
- 1738886400000-add-deleted-at-to-documents.ts (soft delete)
- 1739126400000-add-uploaded-status.ts (статус)
- 1740201600000-create-folders-table.ts (folders)
- 1740801600000-create-permissions-sync-tasks.ts (permissions sync)
- 1741209600000-drive-to-storage-refactor.ts (рефакторинг)

### Команды
```bash
cd backend/documents
npx typeorm migration:run -d typeorm.config.ts
npx typeorm migration:revert -d typeorm.config.ts
```

## 4. Reports (Python/SQL)

### Расположение и структура
- Директория: backend/reports/migrations/
- 1 файл: 001_create_deal_pipeline_summary.sql

### Содержимое
- Создает схему reports
- Материализованное представление deal_pipeline_summary
- Индекс по status

### Команды
```bash
cd backend/reports/migrations
psql "$REPORTS_DATABASE_URL" \
  -v reports_schema="${REPORTS_SCHEMA:-reports}" \
  -v crm_schema="${REPORTS_CRM_SCHEMA:-crm}" \
  -f 001_create_deal_pipeline_summary.sql
```

## 5. Bootstrap скрипт (scripts/migrate-local.sh)

### Порядок выполнения
1. Загрузка .env файла
2. Auth миграции: ./gradlew update
3. CRM миграции: poetry run alembic upgrade head (с повторами до 10 раз)
4. Reports миграции: psql с параметрами

### Параметры и обработка ошибок
- CRM: 10 попыток с интервалом 5 секунд
- Reports: Graceful skip если недоступен
- Auth: Обязателен для успешного выполнения

### Требуемые переменные окружения
- CRM_DATABASE_URL
- AUTH_DATABASE_URL
- REPORTS_DATABASE_URL или DATABASE_URL
- REPORTS_SCHEMA (опционально)
- REPORTS_CRM_SCHEMA (опционально)

