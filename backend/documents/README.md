# Documents Service

## Назначение
Documents управляет метаданными файлов, синхронизацией с Google Drive и очередями обработки документов, предоставляя REST API и вебхуки для других сервисов.【F:docs/architecture.md†L15-L18】【F:docs/tech-stack.md†L232-L256】

## Требования к окружению
- Node.js LTS (18+) с поддержкой NestJS и TypeScript, менеджер пакетов pnpm или npm.【F:docs/tech-stack.md†L232-L240】
- PostgreSQL (схема `documents`), Redis/BullMQ для фоновых задач и доступ к сервисному аккаунту Google Drive.【F:docs/tech-stack.md†L238-L250】
- Переменные окружения `DOCUMENTS_SERVICE_PORT`, `DOCUMENTS_DATABASE_URL`, `DOCUMENTS_REDIS_URL`, `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_SHARED_DRIVE_ID` и другие, описанные в [`env.example`](../../env.example).

## Локальный запуск
1. Установите зависимости: `corepack enable pnpm && pnpm install`.
2. Запустите миграции TypeORM (при их появлении): `pnpm typeorm migration:run`.
3. Поднимите сервис в режиме разработки:
   ```bash
   pnpm start:dev
   ```
   По умолчанию приложение слушает порт из `DOCUMENTS_SERVICE_PORT` (рекомендуется `8084`).

## Миграции и скрипты
- Каталог [`migrations`](migrations/) предназначен для TypeORM миграций (SQL/TS).
- Для фоновых воркеров BullMQ используйте отдельную команду `pnpm start:worker` (добавьте в `package.json` вместе с реализацией).

## Запуск в Docker
1. Соберите образ (пример команды для стандартного Dockerfile NestJS):
   ```bash
   docker build -t documents-service:local -f docker/Dockerfile.documents .
   ```
2. Запустите контейнер, подключив переменные окружения и том с сервисным аккаунтом Google:
   ```bash
   docker run --rm -p ${DOCUMENTS_SERVICE_PORT:-8084}:8084 \
     --env-file ../../env.example \
     -v $PWD/credentials:/app/credentials:ro \
     documents-service:local
   ```

## Полезные ссылки
- Архитектурный обзор домена документов: [`docs/architecture.md`](../../docs/architecture.md#1-общая-структура-сервисов).【F:docs/architecture.md†L15-L18】
- Технологический стек и интеграции Google Drive: [`docs/tech-stack.md`](../../docs/tech-stack.md#documents).【F:docs/tech-stack.md†L232-L250】
