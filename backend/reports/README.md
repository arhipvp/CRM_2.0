# Reports Service

## Назначение
Reports агрегирует показатели CRM и Audit для построения управленческих дашбордов и выгрузок. Первый инкремент предоставляет FastAPI‑endpoint `/api/v1/aggregates/deal-pipeline`, который читает материализованное представление `deal_pipeline_summary` и отдаёт сумму и количество сделок по статусам.【F:backend/reports/reports/api/routes.py†L7-L24】【F:backend/reports/reports/models.py†L6-L16】

## Выбор стека
- **Бэкенд:** FastAPI + SQLAlchemy 2.0 (async) — решение принято на архитектурном ревью, чтобы унифицировать Python‑сервисы и упростить доступ к материализованным представлениям Postgres.
- **Упаковка:** Poetry (по аналогии с CRM) и CLI-скрипты (`reports-api`, `reports-refresh-views`) для запуска API и обновления витрин.

## Требования к окружению
- Python 3.11, Poetry ≥1.5.
- Доступ к схемам CRM/Audit в общем PostgreSQL-кластере и созданный пользователь/схема `reports` (см. миграции).【F:backend/reports/migrations/001_create_deal_pipeline_summary.sql†L1-L33】
- Переменные окружения `REPORTS_DATABASE_URL`, `REPORTS_SERVICE_PORT`, `REPORTS_CRM_SCHEMA`, `REPORTS_AUDIT_SCHEMA`, `REPORTS_SCHEMA`, `REPORTS_SOURCE_SCHEMAS` описаны в [`env.example`](../../env.example).

## Локальный запуск
```bash
cd backend/reports
poetry install
poetry run reports-api
```
По умолчанию сервис слушает `0.0.0.0:${REPORTS_SERVICE_PORT:-8087}`. Для горячего обновления витрины используйте `poetry run reports-refresh-views` (выполняет `REFRESH MATERIALIZED VIEW` для `deal_pipeline_summary`).【F:backend/reports/reports/scripts/refresh_views.py†L1-L31】

## API
- `GET /health` — проверка подключения к базе данных.
- `GET /api/v1/aggregates/deal-pipeline` — агрегированная статистика сделок CRM по статусам.

## Миграции и скрипты
- SQL-скрипт [`migrations/001_create_deal_pipeline_summary.sql`](migrations/001_create_deal_pipeline_summary.sql) создаёт схему `reports` и материализованное представление. Запуск через `psql`:
  ```bash
  cd backend/reports/migrations
  psql "$DATABASE_URL" \
    -v reports_schema=${REPORTS_SCHEMA:-reports} \
    -v crm_schema=${REPORTS_CRM_SCHEMA:-crm} \
    -f 001_create_deal_pipeline_summary.sql
  ```
- Для пересчёта витрин предусмотрен Python-скрипт [`reports/scripts/refresh_views.py`](reports/scripts/refresh_views.py) (запускается через `poetry run reports-refresh-views`).

## Запуск в Docker
Отдельный образ и профиль Compose будут добавлены после интеграции с CI/CD. До этого момента сервис можно запускать локально через Poetry.

## Полезные ссылки
- Общее описание домена и текущие ограничения: [`README.md`](../../README.md#4-ответственность-сервисов).【F:README.md†L53-L74】
- Источник агрегированных событий в Audit: [`docs/tech-stack.md`](../../docs/tech-stack.md#audit).【F:docs/tech-stack.md†L351-L353】
