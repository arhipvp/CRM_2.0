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

API будет доступно на `http://localhost:${TASKS_SERVICE_PORT}/api`. Эндпоинт `GET /api/health` возвращает статус сервиса. Создание, перенос, обновление и завершение задач выполняются через REST-команды `/api/tasks`.

### Создание задачи
`POST /api/tasks` принимает JSON с основными атрибутами задачи:

- `subject` — заголовок (до 255 символов).
- `description` — подробности (опционально).
- `assignee_id` — UUID исполнителя.
- `author_id` — UUID постановщика.
- `due_date` — плановая дата завершения (ISO8601, например `2024-03-10`).
- `priority` — `low`/`normal`/`high` (опционально).
- `context` — объект с доменными идентификаторами (`deal_id`, `policy_id` и т.п.).

Сервис дописывает `assignee_id`/`author_id` в `payload` (в camelCase и snake_case) вместе с приоритетом и контекстом, поэтому
в ответе `TaskResponseDto` эти значения возвращаются готовыми полями `assigneeId`, `priority`, `dealId`, `context` без ручного
парсинга JSON.

### Список задач
`GET /api/tasks` возвращает массив `TaskResponseDto` и поддерживает фильтрацию:

- `assigneeId` — UUID исполнителя (по данным в `payload`).
- `status[]` — коды статусов (`pending`, `scheduled`, `in_progress`, `completed`, `cancelled`).
- `dueBefore` / `dueAfter` — ISO8601 даты дедлайна.
- `priority[]` — приоритет из `payload` (`low`, `normal`, `high`).
- `limit` и `offset` — пагинация; по умолчанию `limit = 50`.

Все параметры необязательны и могут комбинироваться. Результат отсортирован по `dueAt`, затем по `createdAt`.

Ответ содержит поля `TaskResponseDto`: базовые реквизиты задачи (`id`, `title`, `statusCode`, даты) и данные `payload`.
Клиентам не нужно разбирать JSON вручную: `assigneeId`, `priority`, `dealId`, `clientId`, а также контекст
(`context.dealId`/`context.policyId`) присутствуют как отдельные свойства DTO.

### Обновление статуса задачи
`PATCH /api/tasks/:id` позволяет переводить задачу между статусами (`pending`, `scheduled`, `in_progress`, `completed`, `cancelled`) и обновлять дедлайн.

- Переходы доступны только в сторону "вперёд": например, из `completed` или `cancelled` вернуться в `in_progress` нельзя.
- Для статуса `completed` разрешено передавать `completedAt` (без поля автоматически проставляется текущее время).
- При переводе в `cancelled` обязательна `cancelledReason`, очередь отложенных задач очищается автоматически.
- Изменять `cancelledReason` можно только при переводе в `cancelled` или когда задача уже находится в этом статусе; при возврате в активные статусы причина не изменяется.
- Поле `dueDate` (ISO8601 дата) переносит срок исполнения, `null` удаляет дедлайн.

### Воркеры отложенных задач
Для активации отложенных задач поднимите отдельный процесс:

```bash
TASKS_WORKER_ENABLED=true pnpm start:workers
```

Команда запускает приложение в режиме `NestApplicationContext`, включает планировщик и каждые `TASKS_WORKER_POLL_INTERVAL_MS` миллисекунд считывает задания из Redis-очереди `TASKS_DELAYED_QUEUE_KEY`. Для продакшен-профиля используйте `pnpm start:workers:prod`.

## Модель данных
Tasks использует схему `tasks` в PostgreSQL. Основные сущности описаны в каталоге [`src/tasks/entities`](src/tasks/entities/):

- `TaskStatusEntity` (`task_statuses`) — справочник статусов с техническим кодом, названием, описанием и флагом `is_final` для завершённых состояний.
- `TaskEntity` (`tasks`) — сами задачи с полями `title`, `description`, связью на статус, плановым дедлайном (`due_at`), моментом активации отложенной задачи (`scheduled_for`), произвольным `payload`, отметками `completed_at` и `cancelled_reason`. Таймстемпы `created_at` и `updated_at` поддерживаются автоматически.

Конфигурация TypeORM вынесена в [`typeorm.config.ts`](typeorm.config.ts), что позволяет выполнять миграции и seed-скрипты вне NestJS. Проверьте раздел ниже, чтобы подключить их к локальной базе.

## Миграции и seed-данные
- Каталог [`migrations`](migrations/) содержит TypeORM миграции. Выполняйте их через `pnpm migration:run`; для отката используйте `pnpm migration:revert`.
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

Для воркера укажите `pnpm start:workers:prod` в качестве команды контейнера и включите `TASKS_WORKER_ENABLED=true`.

## Полезные ссылки
- Доменные обязанности Tasks: [`docs/architecture.md`](../../docs/architecture.md#1-общая-структура-сервисов).【F:docs/architecture.md†L13-L17】
- Технологический стек: [`docs/tech-stack.md`](../../docs/tech-stack.md#tasks).【F:docs/tech-stack.md†L261-L285】
