# CRM / Deals Service

## Назначение
CRM/Deals управляет клиентами, сделками, полисами и связанными задачами, а также включает модуль платежей с таблицами `crm.payments`, `crm.payment_incomes`, `crm.payment_expenses` и собственными историями изменений. Все операции фиксируются непосредственно в базе CRM без внешних очередей или зависимостей от архивного сервиса Payments; обмен событиями с другими подсистемами происходит через `crm.events`.【F:docs/architecture.md†L11-L66】【F:docs/tech-stack.md†L172-L204】

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
- BullMQ-очередь синхронизации прав настраивается переменными `CRM_PERMISSIONS_QUEUE_NAME`, `CRM_PERMISSIONS_QUEUE_PREFIX`, `CRM_PERMISSIONS_JOB_NAME`; при отсутствии `CRM_PERMISSIONS_REDIS_URL` используется общий Redis (`CRM_REDIS_URL`).
- Обязателен сервис Documents: переменная `CRM_DOCUMENTS_BASE_URL` должна указывать на его REST API, иначе загрузка настроек завершится ошибкой (`crm.app.config.Settings`). Модуль полисов использует репозиторий `PolicyDocumentRepository` и внешний ключ `fk_policy_documents_document_id` к таблице `documents.documents`, поэтому без работающего сервиса падут маршруты `/api/v1/policies/{policyId}/documents`, миграции и интеграционные тесты.
- Класс настроек `crm.app.config.Settings` считывает только переменные с префиксом `CRM_` и игнорирует любые глобальные ключи в `.env`. Это позволяет хранить общие параметры для других сервисов в одном файле без риска падения CRM.

## Быстрый запуск (локально)
1. Установите зависимости:
   ```bash
   cd backend/crm
   poetry install
   ```
2. Синхронизируйте переменные окружения: `../../scripts/sync-env.sh backend/crm` создаст или обновит `.env`. После копирования проверьте и заполните блок CRM (`CRM_DATABASE_URL`, `CRM_REDIS_URL`, `CRM_RABBITMQ_URL`, `CRM_EVENTS_EXCHANGE`) и замените чувствительные данные на локальные значения. Если планируете работать с Documents, заранее настройте корневой `.env` (переменные `DOCUMENTS_STORAGE_*`, см. [`docs/local-setup.md`](../../docs/local-setup.md#интеграции)).
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
6. Платёжный модуль предоставляет вложенные REST-ресурсы:
   - `/api/v1/deals/{dealId}/policies/{policyId}/payments` и `/api/v1/deals/{dealId}/policies/{policyId}/payments/{paymentId}` для операций с платежами;
   - `/api/v1/deals/{dealId}/policies/{policyId}/payments/{paymentId}/incomes` для поступлений;
   - `/api/v1/deals/{dealId}/policies/{policyId}/payments/{paymentId}/expenses` для расходов.
   Он использует те же зависимости, что и основной сервис CRM. Дополнительных брокеров сообщений или внешних воркеров не требуется: фоновые задачи сохраняют движения средств напрямую в БД и публикуют события `payment.*` в `crm.events` через общий слой доменных уведомлений.

## REST API
- `GET /api/v1/clients` — список клиентов.
- `POST /api/v1/clients` — создание клиента.
- `GET /api/v1/deals`, `POST /api/v1/deals` — работа со сделками (список отсортирован по `next_review_at`, затем по `updated_at`).
- `GET /api/v1/policies`, `POST /api/v1/policies` — управление полисами.
- `GET /api/v1/tasks`, `POST /api/v1/tasks` — задачи первого уровня.
- `POST /api/v1/permissions/sync` — постановка задания BullMQ на синхронизацию прав доступа для сущности (`owner_type`, `owner_id`, список пользователей и ролей).
- `PATCH`-эндпоинты поддерживают частичные обновления для всех сущностей.
Описание контрактов с примерами приведено в [`docs/api/crm-deals.md`](../../docs/api/crm-deals.md).

## Notifications
- REST-эндпоинты:
  - `GET /api/v1/templates` и `POST /api/v1/templates` — управление шаблонами уведомлений (`crm.notification_templates`).
  - `POST /api/v1/notifications` — постановка уведомления в доставку с публикацией в RabbitMQ/Redis и записью попыток (`crm.notifications`, `crm.notification_delivery_attempts`).
  - `GET /api/v1/notifications/{id}` — получение статуса, количества попыток и списка каналов.
  - `POST /api/notifications/events` — приём внешних событий с идемпотентной обработкой (RabbitMQ, Telegram, SSE).
  - `GET /api/notifications/stream` и `GET /api/notifications/health` — SSE-канал и health-check для Gateway/клиентов.
- Фоновые процессы:
  - `NotificationQueueConsumer` подключается к `notifications.exchange` и обрабатывает очередь `CRM_NOTIFICATIONS_QUEUE_NAME`, используя настройки `CRM_NOTIFICATIONS_*` (RabbitMQ/Redis/Telegram). Консьюмер запускается вместе с FastAPI-приложением и повторяет обработку при сбоях.
  - Публикация уведомлений в RabbitMQ и Redis выполняется через `NotificationDispatcher` (реализация на `aio-pika` и `redis.asyncio`).
- Telegram интеграция управляется переменными `CRM_NOTIFICATIONS_TELEGRAM_*`; для разработки поддерживается mock-режим (`CRM_NOTIFICATIONS_TELEGRAM_MOCK=true`).
- База данных: миграция `2024072801_add_notifications.py` создаёт таблицы `crm.notification_templates`, `crm.notifications`, `crm.notification_delivery_attempts`, `crm.notification_events`.
- SSE-поток построен на `sse-starlette` и переиспользуется консюмером и REST-эндпоинтами через `NotificationStreamService`.

## Миграции
Alembic настроен на схему `crm`, baseline (`2024031501_baseline.py`) создаёт основные таблицы CRM с полями `owner_id` для управления правами доступа. Команды:
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
Тесты поднимают временные контейнеры PostgreSQL/RabbitMQ/Redis, применяют миграции и проверяют REST API, в том числе сценарии для платежей (создание, списания, возвраты) и публикацию доменных событий `payment.*` в `crm.events`. Для контейнера RabbitMQ используется клиентская библиотека `pika`, она включена в dev-зависимости (`poetry install --with dev`).

> **Важно.** Интеграционный сценарий `test_policy_documents_flow` использует фикстуру `document_id`, которая создаёт тестовый документ в схеме `documents`. Для успешного выполнения убедитесь, что таблица `documents.documents` создана миграциями сервиса Documents и доступна в тестовой БД: фикстура добавляет запись перед тестом и удаляет её после завершения.

## Контейнеризация

CRM/Deals собирается через общий Dockerfile `infra/docker/python-poetry-service.Dockerfile` с аргументом `SERVICE_PATH=backend/crm`.
Базовый слой фиксирует переменные окружения `POETRY_VIRTUALENVS_CREATE=0` и `POETRY_VIRTUALENVS_IN_PROJECT=0`, поэтому при сборке и запуске
`poetry run` использует системные пакеты образа без создания вложенного `.venv`. Проверка после сборки:

```bash
docker build --build-arg SERVICE_PATH=backend/crm -f infra/docker/python-poetry-service.Dockerfile -t crm-deals:local .
docker run --rm crm-deals:local poetry run crm-api
```

Команда `poetry run crm-api` подтягивает `uvicorn` из системного окружения образа; при отсутствии зависимостей она завершится ошибкой импорта.

> **Совет.** Перед пересборкой образа выполняйте `poetry lock`, чтобы обновить `poetry.lock` и убедиться, что в продакшен-окружение попадёт `uvicorn[standard]`. Проверить наличие зависимости можно командой `poetry install --without dev && poetry show uvicorn`.

## Полезные ссылки
- Архитектура и взаимодействия CRM: [`docs/architecture.md`](../../docs/architecture.md#2-взаимодействия-и-потоки-данных).【F:docs/architecture.md†L11-L66】
- Технологический стек CRM/Deals: [`docs/tech-stack.md`](../../docs/tech-stack.md#crm--deals).【F:docs/tech-stack.md†L172-L204】
