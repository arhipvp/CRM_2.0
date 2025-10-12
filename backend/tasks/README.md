# Tasks Service

## Назначение
Tasks отвечает за планирование и исполнение задач, SLA и напоминания, обрабатывая команды и события из CRM/Deals, Payments и Notifications через RabbitMQ и Redis таймеры.【F:docs/architecture.md†L13-L17】【F:docs/tech-stack.md†L261-L285】

## Требования к окружению
- Node.js LTS (18+) и NestJS с модулями @nestjs/schedule, CQRS и @golevelup/nestjs-rabbitmq.【F:docs/tech-stack.md†L263-L269】
- PostgreSQL (схема `tasks`), RabbitMQ (`tasks.command`, `tasks.events`) и Redis для блокировок и отложенных задач.【F:docs/tech-stack.md†L267-L279】
- Переменные `TASKS_SERVICE_PORT`, `TASKS_DATABASE_URL`, `TASKS_RABBITMQ_URL`, `TASKS_REDIS_URL` и т.п. в [`env.example`](../../env.example).

## Локальный запуск
1. Установите зависимости: `corepack enable pnpm && pnpm install`.
2. Выполните миграции TypeORM: `pnpm typeorm migration:run`.
3. Запустите API и воркеры (при необходимости раздельно):
   ```bash
   pnpm start:dev
   pnpm start:workers
   ```

## Миграции и скрипты
- Каталог [`migrations`](migrations/) содержит TypeORM миграции для схемы `tasks`.
- Для e2e/контрактных тестов задействуйте команды `pnpm test` и `pnpm test:e2e` (добавьте в `package.json`).【F:docs/tech-stack.md†L281-L285】
- ⚠️ Миграции ещё не созданы и будут добавлены вместе с исходным кодом сервиса.

## Запуск в Docker
1. Соберите образ:
   ```bash
   docker build -t tasks-service:local -f docker/Dockerfile.tasks .
   ```
2. Запуск контейнера:
   ```bash
   docker run --rm -p ${TASKS_SERVICE_PORT:-8086}:8086 \
     --env-file ../../env.example \
     tasks-service:local
   ```
   Для воркеров используйте отдельный контейнер с командой `pnpm start:workers`.

## Полезные ссылки
- Доменные обязанности Tasks: [`docs/architecture.md`](../../docs/architecture.md#1-общая-структура-сервисов).【F:docs/architecture.md†L13-L17】
- Технологический стек: [`docs/tech-stack.md`](../../docs/tech-stack.md#tasks).【F:docs/tech-stack.md†L261-L285】
