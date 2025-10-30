# Сводка по структуре миграций CRM 2.0

## Быстрый справочник

### Запуск всех миграций сразу
```bash
./scripts/migrate-local.sh
```

### Запуск миграций отдельного сервиса

**CRM (Python/Alembic)**
```bash
cd backend/crm
poetry run alembic upgrade head
```

**Auth (Spring Boot/Liquibase)**
```bash
cd backend/auth
./gradlew update
```

**Documents (Node.js/TypeORM)**
```bash
cd backend/documents
npx typeorm migration:run -d typeorm.config.ts
```

**Reports (SQL)**
```bash
cd backend/reports/migrations
psql "$REPORTS_DATABASE_URL" \
  -v reports_schema="${REPORTS_SCHEMA:-reports}" \
  -v crm_schema="${REPORTS_CRM_SCHEMA:-crm}" \
  -f 001_create_deal_pipeline_summary.sql
```

## Статистика миграций

| Сервис | Инструмент | Миграции | Схемы | Статус |
|--------|-----------|----------|-------|--------|
| CRM | Alembic | 18 | crm, tasks | Активно развивается |
| Auth | Liquibase | 1 changeset | auth | Стабильно |
| Documents | TypeORM | 6 | documents | Развивается |
| Reports | SQL | 1 | reports | Базовая версия |

## Ключевые файлы миграций

**CRM - последние 3 миграции**
- 2025102601_add_tasks_module.py (30.10.2025)
- 2025102602_add_premium_to_policies.py
- 2025102604_migrate_crm_tasks_to_tasks_schema.py

**Auth**
- 0001-init-auth-tables.yaml (инициализация users/roles)

**Documents - последние 2 миграции**
- 1740801600000-create-permissions-sync-tasks.ts
- 1741209600000-drive-to-storage-refactor.ts

**Reports**
- 001_create_deal_pipeline_summary.sql

## Переменные окружения для миграций

Обязательные:
- CRM_DATABASE_URL=postgresql://...
- AUTH_DATABASE_URL=r2dbc:postgresql://...
- REPORTS_DATABASE_URL=postgresql://... или DATABASE_URL

Опционально:
- REPORTS_SCHEMA (по умолчанию: reports)
- REPORTS_CRM_SCHEMA (по умолчанию: crm)
- DOCUMENTS_RUN_MIGRATIONS=true (auto-run при старте)

## Таблицы версионирования

| Сервис | Таблица | База данных |
|--------|---------|-------------|
| CRM | crm.alembic_version | Есть |
| Auth | databasechangelog | Есть |
| Documents | documents.documents_migrations | Есть |
| Reports | - | Нет (ручное управление) |

## Порядок выполнения в bootstrap скрипте

1. **Auth** (обязательно)
   - Должна быть успешной для работы остальных
   - Команда: ./gradlew update

2. **CRM** (с повторами)
   - До 10 попыток через 5 секунд
   - Причина: часто БД не готова при первых попытках

3. **Reports** (graceful skip)
   - Пропускается если psql не установлен
   - Пропускается если файл миграции отсутствует

## Создание новых миграций

**CRM**
```bash
cd backend/crm
poetry run alembic revision -m "feature description"
# Отредактируйте upgrade() и downgrade()
```

**Auth**
```bash
# Создайте файл 0002-new-feature.yaml в changesets/
# Обновите db.changelog-master.yaml
cd backend/auth
./gradlew update
```

**Documents**
```bash
cd backend/documents
npx typeorm migration:create src/migrations/NewMigration
# Отредактируйте up() и down()
```

**Reports**
```bash
# Создайте файл 002_new_feature.sql в migrations/
psql "$REPORTS_DATABASE_URL" -f 002_new_feature.sql
```

## Важные замечания

1. **CRM**: Новейшие миграции связаны с добавлением модуля Tasks и разделением на отдельную схему
2. **Auth**: Минимальное количество миграций - стабильная базовая структура
3. **Documents**: Активное развитие - много недавних добавлений
4. **Reports**: На ранней стадии - только одна базовая миграция
5. **Bootstrap**: Порядок выполнения критичен - Auth должен быть успешен

## Файлы документации

- C:\Dev\CRM_2.0\.claude\MIGRATIONS_STRUCTURE.md (краткая сводка)
- C:\Dev\CRM_2.0\.claude\MIGRATIONS_DETAILED.md (подробный анализ)
- C:\Dev\CRM_2.0\scripts\migrate-local.sh (главный скрипт)

