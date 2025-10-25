# Reports Service

## Назначение
Сервис Reports агрегирует показатели из CRM, готовя витрины для управленческих дашбордов и экспортов. Исторически источником также служил сервис Audit, но в локальном окружении он отключён. Первый инкремент реализует FastAPI-приложение, которое считывает материализованное представление `deal_pipeline_summary` и отдаёт количество сделок и временные границы активности по статусам.

## Архитектурный стек
- **Бэкенд:** FastAPI + асинхронный SQLAlchemy 2.0 поверх `asyncpg` для чтения из PostgreSQL.
- **Конфигурация:** `pydantic-settings` с префиксом `REPORTS_` для всех переменных окружения (см. `reports/config.py`).
- **Упаковка и зависимости:** Poetry; точка входа `reports-api` запускает Uvicorn, `reports-refresh-views` обновляет витрины.

## Подключения к CRM
- Основной URL к кластерам PostgreSQL задаётся через `REPORTS_DATABASE_URL`. При запуске сервис автоматически конвертирует синхронный URL `postgresql://` в асинхронный `postgresql+asyncpg://`.
- Настройки схем для чтения исходных данных (`REPORTS_CRM_SCHEMA`) и целевой схемы отчётного сервиса (`REPORTS_SCHEMA`) доступны в `reports/config.py`. Вспомогательное свойство `source_schema_list` удобно для обработки нескольких источников в одном цикле: для локального профиля достаточно `REPORTS_SOURCE_SCHEMAS=crm`.
- SQLAlchemy `MetaData` фиксирует схему `REPORTS_SCHEMA`, чтобы запросы не требовали явного указания `search_path`. Модель `deal_pipeline_summary_view` описывает материализованное представление, а репозиторий `fetch_deal_pipeline_summary` использует её для выборки данных по воронке сделок.

## API
- `GET /health` — проверка подключения к базе данных (простое выполнение `SELECT 1`).
- `GET /api/v1/aggregates/deal-pipeline` — отдаёт агрегаты по сделкам из витрины `deal_pipeline_summary` в формате `DealPipelineSummary`.

## Локальный запуск
```bash
cd backend/reports
poetry install
REPORTS_DATABASE_URL="postgresql://reports:reports@localhost:5432/crm?search_path=reports" \
  REPORTS_CRM_SCHEMA=crm REPORTS_SOURCE_SCHEMAS=crm \
  poetry run reports-api
```
По умолчанию Uvicorn слушает `0.0.0.0:${REPORTS_SERVICE_PORT:-8087}` и использует переменные из `.env` или окружения.

### Обновление витрин
```bash
REPORTS_DATABASE_URL=... poetry run reports-refresh-views
```
Скрипт выполняет `REFRESH MATERIALIZED VIEW CONCURRENTLY reports.deal_pipeline_summary`, что полезно для фоновой регенерации отчётных данных.

## Миграции
Каталог `migrations/` содержит шаблонные SQL-скрипты. Первый скрипт `001_create_deal_pipeline_summary.sql` создаёт схему `reports`, материализованное представление и уникальный индекс по статусу сделок.

Запуск через `psql`:
```bash
cd backend/reports/migrations
psql "$DATABASE_URL" \
  -v reports_schema=${REPORTS_SCHEMA:-reports} \
  -v crm_schema=${REPORTS_CRM_SCHEMA:-crm} \
  -f 001_create_deal_pipeline_summary.sql
```
Дополняйте каталог новыми файлами по мере роста витрин и появления дополнительных источников (например, Audit при его возврате в инфраструктуру).

## Структура проекта
```
backend/reports/
├── migrations/                # SQL-скрипты инициализации витрин
├── reports/
│   ├── api/                   # FastAPI маршруты
│   ├── config.py              # Загрузка переменных окружения
│   ├── db.py                  # Создание async engine и сессий
│   ├── main.py                # Точка входа Uvicorn
│   ├── models.py              # SQLAlchemy-таблицы и представления
│   ├── repositories/          # Слой доступа к данным
│   ├── schemas.py             # Pydantic-схемы ответов
│   └── scripts/refresh_views.py
├── pyproject.toml
└── README.md
```

## Дальнейшие шаги
- Добавить дополнительные витрины и агрегаты из CRM и других источников (при их доступности).
- Настроить автоматический запуск миграций и обновление витрин в CI/CD.
- Протянуть авторизацию и контроль доступа для управленческих отчётов.
