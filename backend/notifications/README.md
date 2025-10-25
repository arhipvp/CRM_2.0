# Notifications Service (legacy)

> ⚠️ Сервис переведён на Python и встроен в CRM (`backend/crm`). Этот каталог сохранён для справки и не используется в актуальной поставке. Эндпоинты `/api/v1/templates`, `/api/v1/notifications`, `/api/notifications/events`, `/api/notifications/stream` реализованы в FastAPI-приложении CRM. См. [`backend/crm/README.md`](../crm/README.md#notifications) и переменные `CRM_NOTIFICATIONS_*` в [`env.example`](../../env.example).

## Назначение
Notifications доставляет события и уведомления во внутренний интерфейс (SSE) и Telegram-бот, принимая события из очередей RabbitMQ и публикуя их по минимальному сценарию первой поставки.【F:docs/architecture.md†L13-L17】【F:docs/tech-stack.md†L287-L311】

Расширенные функции (экспорт журнала, автоподписки, расширенные правила доставки) появятся на [Этапе 1.1](../../docs/delivery-plan.md#notifications-export-autosubscribe).

## Требования к окружению
- Node.js LTS (18+) и pnpm 9 (через Corepack) для запуска NestJS и фоновых воркеров.【F:docs/local-setup.md†L43-L69】
- PostgreSQL (схема `notifications`), RabbitMQ (`notifications.events`) и Redis с namespace `notifications:` для хранения статуса доставки и управления подписками.【F:docs/tech-stack.md†L287-L339】
- Переменные окружения `NOTIFICATIONS_HTTP_HOST`, `NOTIFICATIONS_HTTP_PORT`, `NOTIFICATIONS_DB_*`, `NOTIFICATIONS_RABBITMQ_*`, `NOTIFICATIONS_DISPATCH_*`, `NOTIFICATIONS_REDIS_*`, `NOTIFICATIONS_TELEGRAM_*` (включая `NOTIFICATIONS_TELEGRAM_WEBHOOK_*`) и `NOTIFICATIONS_SSE_RETRY_MS` (см. [`env.example`](../../env.example)).

## Локальный запуск
1. Перейдите в каталог `backend/notifications` и установите зависимости: `pnpm install`.
2. Синхронизируйте `.env`: `../../scripts/sync-env.sh backend/notifications --non-interactive` (или без флага для ручного режима). Проверьте блок `NOTIFICATIONS_*` и заполните токен/чат Telegram, если планируете реальную отправку.
3. Запустите HTTP-приложение с live reload: `pnpm start:api:dev`. Проверьте основные маршруты:
   - `GET /api/notifications/health` — проверка готовности сервиса.
   - `GET /api/notifications/stream` — SSE-канал для клиентских интерфейсов и внутренних слушателей.
   - `POST /api/notifications/events` — приём входящих событий вручную (дублирует обработку из RabbitMQ).
   - `GET /api/v1/notifications/{id}` — сводный статус доставки (статус, попытки, каналы, `delivered_at`).
   - `GET /api/v1/templates` — чтение шаблонов уведомлений с фильтрами по каналу и активности.
   - `POST /api/v1/templates` — создание шаблонов, конфликтует по паре `key` + `channel`.
   Для продакшен-режима используйте `pnpm start:api` — скрипт автоматически соберёт и запустит `dist/main.js`.
   - `POST /api/v1/notifications` — постановка уведомления в очередь. Если синхронная отправка через `NotificationEventsService` завершается ошибкой (например, Telegram отклонил сообщение), сервис возвращает `500 notification_dispatch_failed`, фиксируя попытку в `notification_delivery_attempts` и переводя уведомление в статус `failed`.
4. Для запуска фоновых подписчиков RabbitMQ выполните `pnpm start:workers:dev`. Команда поднимает Nest-приложение без HTTP и активирует `@RabbitSubscribe` обработчики. Скомпилированный воркер запускается через `pnpm start:workers` (перед выполнением скрипт соберёт `dist/worker.js`).

## Очередь доставки и повторы

- Каждое уведомление сохраняется в PostgreSQL со статусом `pending`, после чего сообщение отправляется в RabbitMQ, Redis и внутренний обработчик событий.
- Для публикации используется единый механизм повторов: параметры `NOTIFICATIONS_DISPATCH_RETRY_ATTEMPTS` и `NOTIFICATIONS_DISPATCH_RETRY_DELAY_MS` из `.env` применяются ко всем трём каналам (RabbitMQ, Redis, NotificationEventsService).
- Ошибки помечаются в таблице `notification_delivery_attempts`. Если все попытки исчерпаны, сервис выбрасывает исключение, фиксируя статус уведомления как `failed` и последнюю попытку как `failure`.
- При успешной публикации хотя бы одного канала статус обновляется на `queued`, а после завершения всех шагов — на `processed`.

## Миграции и фоновые процессы
- TypeORM конфигурация размещена в [`typeorm.config.ts`](typeorm.config.ts); миграции — в каталоге [`migrations`](migrations/).
- Запуск миграций: `pnpm run migrations:run` (bootstrap вызывает команду автоматически через [`scripts/migrate-local.sh`](../../scripts/migrate-local.sh)).
- Генерация новых миграций: `pnpm run migrations:generate -- <имя>` — файл появится в `migrations/`.
- Для сборки артефактов используйте `pnpm run build:all` (собирает API и воркер). После релиза убедитесь, что HTTP-приложение (`pnpm start:api`) и воркеры (`pnpm start:workers`) запускаются как отдельные процессы и масштабируются независимо.

### Таблицы

- `notification_templates` — шаблоны уведомлений. Уникальный ключ составной: `key` + `channel`. Основные поля: `locale`, `body`, `metadata` (`jsonb`), `status` (`active`/`inactive`), `created_at`, `updated_at`.
- `notifications` — заявки на доставку (API `/api/v1/notifications`). Содержат `eventKey`, получателей (`jsonb`), полезную нагрузку, переопределения каналов, `deduplicationKey`, счётчик попыток и технические поля (`status`, `lastAttemptAt`, `lastError`). Уникальный индекс по `deduplicationKey` обеспечивает идемпотентность.
- `notification_delivery_attempts` — журнал попыток публикации (RabbitMQ, Redis, внутренний обработчик). Фиксируют канал, результат (`success`/`failure`), метаданные и текст ошибки.
- `notification_events` — аудит доставки (исторический журнал событий).

Значение по умолчанию для локали задаётся переменной `NOTIFICATIONS_TEMPLATES_DEFAULT_LOCALE` в `.env` и может быть переопределено при создании шаблона.

## Запуск в Docker
1. Соберите образ:
   ```bash
   docker build -t notifications-service:local -f docker/Dockerfile.notifications .
   ```
2. Запустите контейнер:
   ```bash
   docker run --rm -p ${NOTIFICATIONS_SERVICE_PORT:-8085}:8085 \
     --env-file ../../env.example \
     notifications-service:local
   ```

## Полезные ссылки
- Архитектурный обзор уведомлений: [`docs/architecture.md`](../../docs/architecture.md#2-взаимодействия-и-потоки-данных).【F:docs/architecture.md†L63-L65】
- Стек и зависимости сервиса: [`docs/tech-stack.md`](../../docs/tech-stack.md#notifications).【F:docs/tech-stack.md†L287-L311】
