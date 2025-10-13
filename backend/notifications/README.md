# Notifications Service

## Назначение
Notifications доставляет события и уведомления во внутренний интерфейс (SSE) и Telegram-бот, принимая события из очередей RabbitMQ и публикуя их по минимальному сценарию первой поставки.【F:docs/architecture.md†L13-L17】【F:docs/tech-stack.md†L287-L311】

Расширенные функции (экспорт журнала, автоподписки, расширенные правила доставки) появятся на [Этапе 1.1](../../docs/delivery-plan.md#notifications-export-autosubscribe).

## Требования к окружению
- Node.js LTS (18+) и pnpm 9 (через Corepack) для запуска NestJS и фоновых воркеров.【F:docs/local-setup.md†L43-L69】
- PostgreSQL (схема `notifications`), RabbitMQ (`notifications.events`) и Redis с namespace `notifications:` для хранения статуса доставки и управления подписками.【F:docs/tech-stack.md†L287-L339】
- Переменные окружения `NOTIFICATIONS_HTTP_HOST`, `NOTIFICATIONS_HTTP_PORT`, `NOTIFICATIONS_DB_*`, `NOTIFICATIONS_RABBITMQ_*`, `NOTIFICATIONS_REDIS_*`, `NOTIFICATIONS_TELEGRAM_*` и `NOTIFICATIONS_SSE_RETRY_MS` (см. [`env.example`](../../env.example)).

## Локальный запуск
1. Перейдите в каталог `backend/notifications` и установите зависимости: `pnpm install`.
2. Синхронизируйте `.env`: `../../scripts/sync-env.sh backend/notifications --non-interactive` (или без флага для ручного режима). Проверьте блок `NOTIFICATIONS_*` и заполните токен/чат Telegram, если планируете реальную отправку.
3. Запустите сервис HTTP + SSE: `pnpm start:dev`. Эндпоинты:
   - `POST /notifications/events` — приём входящих событий вручную (дублирует обработку из RabbitMQ).
   - `GET /notifications/stream` — SSE-канал для фронтенда и внутренних слушателей.
4. Для запуска фоновых подписчиков RabbitMQ выполните `pnpm start:workers`. Команда поднимает Nest-приложение без HTTP и активирует `@RabbitSubscribe` обработчики.

## Миграции и фоновые процессы
- TypeORM конфигурация размещена в [`typeorm.config.ts`](typeorm.config.ts); миграции — в каталоге [`migrations`](migrations/).
- Запуск миграций: `pnpm run migrations:run` (bootstrap вызывает команду автоматически через [`scripts/migrate-local.sh`](../../scripts/migrate-local.sh)).
- Генерация новых миграций: `pnpm run migrations:generate -- <имя>` — файл появится в `migrations/`.
- Воркеры событий запускаются командой `pnpm start:workers`; при деплое убедитесь, что процесс масштабируется независимо от HTTP-приложения.

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
# Notifications service

Сервис рассылает уведомления и управляет Telegram-ботом.

## Локальная разработка

* Для отладки webhook и Bot API включите mock-сервер, описанный в [docs/local-setup.md#интеграции](../../docs/local-setup.md#интеграции).
* Переменная `NOTIFICATIONS_TELEGRAM_MOCK=true` разрешает безопасно логировать сообщения вместо фактических запросов в Bot API. Для реальных рассылок установите `NOTIFICATIONS_TELEGRAM_ENABLED=true`, заполните `NOTIFICATIONS_TELEGRAM_BOT_TOKEN` и `NOTIFICATIONS_TELEGRAM_CHAT_ID`, затем переведите `NOTIFICATIONS_TELEGRAM_MOCK=false`.
* Mock не проверяет квоты Telegram — массовые рассылки и работу с медиа перепроверьте в dev/stage.

Архитектурные детали сервиса см. в [`docs/tech-stack.md`](../../docs/tech-stack.md).
