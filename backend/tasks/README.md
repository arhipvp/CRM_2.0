# Tasks Service

## Назначение
Tasks отвечает за планирование и исполнение задач, SLA и напоминания, обрабатывая команды и события из CRM/Deals, Payments и Notifications через RabbitMQ и Redis таймеры.【F:docs/architecture.md†L13-L17】【F:docs/tech-stack.md†L261-L285】

## Требования к окружению
- Node.js LTS (18+) и pnpm 9 для запуска NestJS приложения.
- PostgreSQL (схема `tasks`), RabbitMQ и Redis для очереди отложенных задач.
- Переменные `TASKS_*` в [`env.example`](../../env.example) описывают подключение к БД, брокеру и Redis.

## Локальный запуск
```bash
cd backend/tasks
pnpm install
../../scripts/sync-env.sh backend/tasks
pnpm migration:run
pnpm seed:statuses
pnpm start:dev
```

API будет доступно на `http://localhost:${TASKS_SERVICE_PORT}/api`. Эндпоинт `GET /api/health` возвращает статус сервиса. Создание, перенос и завершение задач выполняются через REST-команды `/api/tasks`.

### Воркеры отложенных задач
Для активации отложенных задач поднимите отдельный процесс:

```bash
TASKS_WORKER_ENABLED=true pnpm worker:dev
```

Команда запускает приложение в режиме `NestApplicationContext`, включает планировщик и каждые `TASKS_WORKER_POLL_INTERVAL_MS` миллисекунд считывает задания из Redis-очереди `TASKS_DELAYED_QUEUE_KEY`.

## Миграции и seed-данные
- Каталог [`migrations`](migrations/) содержит TypeORM миграции. Выполняйте их через `pnpm migration:run`.
- Seed-скрипт `pnpm seed:statuses` обновляет справочник статусов на основе `DEFAULT_TASK_STATUSES` и используется в bootstrap-скриптах.

## Docker (опционально)
Пример сборки через общий образ Node.js:

```bash
docker build -t tasks-service:local -f ../../infra/docker/node.Dockerfile .
```

Запуск API:

```bash
docker run --rm --env-file ../../env.example -p ${TASKS_SERVICE_PORT:-8086}:8086 tasks-service:local pnpm start:prod
```

Для воркера укажите `pnpm worker` в качестве команды контейнера и включите `TASKS_WORKER_ENABLED=true`.

## Полезные ссылки
- Доменные обязанности Tasks: [`docs/architecture.md`](../../docs/architecture.md#1-общая-структура-сервисов).【F:docs/architecture.md†L13-L17】
- Технологический стек: [`docs/tech-stack.md`](../../docs/tech-stack.md#tasks).【F:docs/tech-stack.md†L261-L285】
