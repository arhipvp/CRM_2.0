# Notifications Service

## Назначение
Notifications доставляет события и уведомления во внутренний интерфейс и Telegram-бот, поддерживая REST API, SSE-каналы и очереди RabbitMQ для триггеров напоминаний.【F:docs/architecture.md†L13-L17】【F:docs/tech-stack.md†L287-L311】

## Требования к окружению
- Node.js LTS (18+) и NestJS с @nestjs/platform-sse и @golevelup/nestjs-rabbitmq.【F:docs/tech-stack.md†L289-L307】
- PostgreSQL (схема `notifications`), RabbitMQ (`notifications.events`, очереди Telegram) и Redis для rate limiting.【F:docs/tech-stack.md†L293-L305】
- Настроенные переменные `NOTIFICATIONS_SERVICE_PORT`, `NOTIFICATIONS_DATABASE_URL`, `NOTIFICATIONS_RABBITMQ_URL`, `NOTIFICATIONS_REDIS_URL` (см. [`env.example`](../../env.example)).

## Локальный запуск
1. Установите зависимости: `corepack enable pnpm && pnpm install`.
2. Выполните миграции TypeORM: `pnpm typeorm migration:run`.
3. Запустите сервис:
   ```bash
   pnpm start:dev
   ```
4. Для работы SSE убедитесь, что Gateway пробрасывает соединение или используйте прямой доступ.

## Миграции и фоновые процессы
- Каталог [`migrations`](migrations/) предназначен для TypeORM миграций.
- Для воркеров уведомлений (если вынесены отдельно) добавьте команду `pnpm start:workers`.

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
