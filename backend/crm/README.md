# CRM / Deals Service

## Назначение
CRM/Deals управляет клиентами, сделками, полисами и связанными задачами, а также синхронизируется с платежами через события RabbitMQ. Сервис публикует собственные доменные события в `crm.events` и подписывается на финансовые события из `payments.events`, поддерживая повторные попытки и DLX для обработки ошибок.【F:docs/architecture.md†L11-L66】【F:docs/tech-stack.md†L172-L204】

## Структура проекта
```
crm/
├── app/            # FastAPI-приложение, зависимости, Celery и потребители событий
├── api/            # Маршрутизаторы REST API (клиенты, сделки, полисы, задачи)
├── domain/         # Pydantic-схемы и сервисный слой
├── infrastructure/ # SQLAlchemy-модели, репозитории и доступ к БД
```
Дополнительно:
- `pyproject.toml` — управление зависимостями через Poetry.
- `migrations/` — Alembic-скрипты для схемы `crm` (baseline включён).
- `tests/` — асинхронные интеграционные тесты с Testcontainers (PostgreSQL, RabbitMQ, Redis).

## Требования к окружению
- Python 3.11 (Poetry рекомендуем устанавливать глобально: https://python-poetry.org/docs/).
- PostgreSQL (схема `crm`), Redis и RabbitMQ — URL подключений настраиваются через переменные `CRM_DATABASE_URL`, `CRM_REDIS_URL`, `CRM_RABBITMQ_URL` и дополнительные параметры очередей (см. `env.example`).【F:env.example†L78-L118】
- Для фоновых задач Celery используется Redis (по умолчанию `CRM_CELERY_BROKER_URL=${REDIS_CELERY_URL}`).

## Быстрый запуск (локально)
1. Установите зависимости:
   ```bash
   cd backend/crm
   poetry install
   ```
2. Синхронизируйте переменные окружения: `../../scripts/sync-env.sh backend/crm` создаст или обновит `.env`. После копирования проверьте и заполните блок CRM (`CRM_DATABASE_URL`, `CRM_REDIS_URL`, `CRM_RABBITMQ_URL`, `CRM_EVENTS_EXCHANGE`, `CRM_PAYMENTS_*`) и замените чувствительные данные на локальные значения.
3. Примените миграции:
   ```bash
   poetry run alembic upgrade head
   ```
4. Запустите API (порт и хост берутся из переменных `CRM_SERVICE_PORT`/`CRM_SERVICE_HOST` в `.env`):
   ```bash
   poetry run crm-api
   # или напрямую
   poetry run uvicorn crm.app.main:app --host ${CRM_SERVICE_HOST:-0.0.0.0} --port ${CRM_SERVICE_PORT:-8082}
   ```
   Быстрая проверка на кастомном порту:
   ```bash
   CRM_SERVICE_PORT=9090 poetry run crm-api &
   CRM_API_PID=$!
   sleep 2 && curl -f http://localhost:9090/healthz
   kill $CRM_API_PID
   ```
   Команда запустит сервис на порту `9090`, проверит `GET /healthz` и завершит процесс.
5. Поднимите Celery-воркер (использует очереди Redis):
   ```bash
   poetry run crm-worker worker -l info
   ```
6. Для подписчика платежей предусмотрен асинхронный потребитель `PaymentsEventsSubscriber`, который включается автоматически при старте приложения (можно отключить переменной `CRM_ENABLE_PAYMENTS_CONSUMER=false`). Для отладки в отрыве от API запустите отдельный скрипт:
   ```bash
   poetry run python -m crm.app.events
   ```

## REST API
- `GET /api/v1/clients` — список клиентов.
- `POST /api/v1/clients` — создание клиента.
- `GET /api/v1/deals`, `POST /api/v1/deals` — работа со сделками (список отсортирован по `next_review_at`, затем по `updated_at`).
- `GET /api/v1/policies`, `POST /api/v1/policies` — управление полисами.
- `GET /api/v1/tasks`, `POST /api/v1/tasks` — задачи первого уровня.
- `PATCH`-эндпоинты поддерживают частичные обновления для всех сущностей.
Описание контрактов с примерами приведено в [`docs/api/crm-deals.md`](../../docs/api/crm-deals.md).

## Миграции
Alembic настроен на схему `crm`, baseline (`2024031501_baseline.py`) создаёт таблицы с колонками `tenant_id`/`owner_id` для RLS. Команды:
```bash
poetry run alembic revision -m "feature"  # создаёт новую ревизию
poetry run alembic upgrade head           # применяет миграции
poetry run alembic downgrade -1           # откатывает последнюю ревизию
```

### Быстрый запуск миграций CRM и Auth

Для локальной подготовки БД CRM и Auth используйте общий скрипт из корня репозитория:

```bash
./scripts/migrate-local.sh
```

Сценарий загружает переменные из `.env`, применяет Alembic (`poetry run alembic upgrade head`) и затем запускает Liquibase (`./gradlew update`) в сервисе Auth. Убедитесь, что PostgreSQL и Redis доступны, а `.env` создан на основе `env.example`.

## Тесты
Интеграционные тесты используют Testcontainers, поэтому требуется доступ к Docker daemon:
```bash
poetry run pytest tests
```
Тесты поднимают временные контейнеры PostgreSQL/RabbitMQ/Redis, применяют миграции и проверяют REST API и обработку очередей `payments.events` → `crm.events` с повторными попытками и DLX. Для контейнера RabbitMQ используется клиентская библиотека `pika`, она включена в dev-зависимости (`poetry install --with dev`).

## Полезные ссылки
- Архитектура и взаимодействия CRM: [`docs/architecture.md`](../../docs/architecture.md#2-взаимодействия-и-потоки-данных).【F:docs/architecture.md†L11-L66】
- Технологический стек CRM/Deals: [`docs/tech-stack.md`](../../docs/tech-stack.md#crm--deals).【F:docs/tech-stack.md†L172-L204】
