# Documents Service

Сервис управляет метаданными клиентских документов, очередями загрузки и синхронизации с Google Drive и предоставляет REST API
для других доменов CRM.【F:docs/architecture.md†L15-L18】

## Основные возможности
- CRUD API по метаданным документов (`/documents`).
- Фоновые задачи BullMQ для загрузки (`documents.upload`) и синхронизации (`documents.sync`) файлов.
- Интеграция с Google Drive через сервисный аккаунт либо локальный эмулятор (MinIO/LocalStack).
- Безопасная работа с пустыми или отсутствующими метаданными: сервис объединяет данные Drive с исходными значениями, избегая ошибок
  сериализации.
- TypeORM миграции схемы `documents` и изолированное подключение к PostgreSQL.

## Требования к окружению
- Node.js 20 LTS, pnpm 9+ (`corepack prepare pnpm@9 --activate`).
- PostgreSQL (схема `documents`) с включённой функцией `gen_random_uuid()` (`CREATE EXTENSION IF NOT EXISTS pgcrypto`).
- Redis 6+ для очередей BullMQ.
- Сервисный аккаунт Google Drive **или** локальный эмулятор, описанный в [`docs/local-setup.md`](../../docs/local-setup.md#интеграции).

Минимальный набор переменных окружения описан в [`env.example`](../../env.example) и валидируется при старте. Обратите внимание на
`DOCUMENTS_RUN_MIGRATIONS` — переменная управляет автоматическим применением миграций при запуске API/воркера.

## Установка зависимостей
```bash
cd backend/documents
pnpm install
```

## Команды
| Команда | Назначение |
| --- | --- |
| `pnpm start:dev` | Запуск REST API с hot-reload на `http://localhost:${DOCUMENTS_SERVICE_PORT}`. |
| `pnpm start` | Запуск API без watch. |
| `pnpm start:worker` | Отдельный воркер BullMQ (обрабатывает очереди загрузки/синхронизации). |
| `pnpm build` | Сборка в `dist/`. |
| `pnpm test:e2e` | E2E-тестирование `/health`. |

> В development-режиме API и воркер можно запускать параллельно (`pnpm start:dev` + `pnpm start:worker:dev`).

## Конфигурация
| Переменная | Назначение |
| --- | --- |
| `DOCUMENTS_DATABASE_URL` | Подключение к PostgreSQL со схемой `documents`. |
| `DOCUMENTS_DATABASE_SCHEMA` | Имя схемы (по умолчанию `documents`). |
| `DOCUMENTS_RUN_MIGRATIONS` | Автоматически применять миграции при старте (false по умолчанию). |
| `DOCUMENTS_REDIS_URL` | Redis для BullMQ. |
| `DOCUMENTS_REDIS_PREFIX` | Префикс ключей Redis (по умолчанию `documents`). |
| `DOCUMENTS_QUEUE_NAME` | Имя очереди BullMQ (по умолчанию `documents:tasks`). |
| `DOCUMENTS_UPLOAD_URL_BASE` | Базовый URL объектного хранилища для формирования подписанной ссылки. |
| `DOCUMENTS_UPLOAD_URL_TTL` | Время жизни подписанной ссылки на загрузку (секунды, по умолчанию 900). |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`/`GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH` | JSON сервисного аккаунта или путь к файлу. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Альтернативный путь до JSON ключа (совместимо с SDK Google). |
| `GOOGLE_DRIVE_SHARED_DRIVE_ID` | ID Shared Drive для реальной интеграции. |
| `GOOGLE_DRIVE_EMULATOR_URL` | URL локального эмулятора (MinIO/LocalStack). |
| `GOOGLE_DRIVE_EMULATOR_ROOT` | Корневая папка/идентификатор каталога эмулятора. |

Переменные `GOOGLE_DRIVE_*` могут быть пустыми в dev-режиме — тогда используется эмулятор. В stage/prod требуется валидный
сервисный аккаунт.

## Сервисный аккаунт Google Drive
1. Получите JSON ключ сервисного аккаунта и сохраните его в `backend/documents/credentials/service-account.json` **или** укажите
   путь в `GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH`/`GOOGLE_APPLICATION_CREDENTIALS`.
2. Чтобы передать содержимое напрямую, используйте `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` (подходит для CI).
3. При запуске без этих переменных модуль `DriveService` попытается использовать эмулятор (`GOOGLE_DRIVE_EMULATOR_URL`).

## REST API
- `GET /health` — состояние сервиса.
- `GET /documents` — список документов (фильтрация по статусу, владельцу, типу, полнотекстовый поиск по названию/описанию, пагинация через `offset`/`limit`).
- `GET /documents/:id` — детали документа.
- `POST /documents` — создать запись, получить `upload_url` и `expires_in`. По умолчанию добавляет задание `documents.upload`.
- `PATCH /documents/:id` — обновить метаданные.
- `DELETE /documents/:id` — мягкое удаление: запись помечается как удалённая, доступ Drive отзывается (повторный вызов вернёт `409 already_deleted`).
- `POST /documents/:id/upload` — переотправить документ в очередь загрузки.
- `POST /documents/:id/complete` — подтвердить завершение загрузки и поставить задачу синхронизации.
- `POST /documents/:id/sync` — обновить метаданные из Drive.

Список статусов: `draft`, `pending_upload`, `uploading`, `uploaded`, `synced`, `error`.

## Миграции
TypeORM-конфигурация расположена в [`typeorm.config.ts`](./typeorm.config.ts). Базовые команды:
```bash
pnpm typeorm migration:run -d typeorm.config.ts
pnpm typeorm migration:revert -d typeorm.config.ts
```

Начальная миграция `1737043200000-init-documents-table.ts` создаёт схему `documents`, перечисление статусов и таблицу `documents`.
Миграция `1738886400000-add-deleted-at-to-documents.ts` добавляет колонку `deleted_at` и индекс для мягкого удаления.
Доступные миграции:
- `1737043200000-init-documents-table.ts` — создаёт схему `documents`, перечисление статусов и таблицу `documents`.
- `1739126400000-add-uploaded-status.ts` — добавляет статус `uploaded` в перечисление состояний.

## Локальный эмулятор Google Drive
1. Поднимите MinIO/LocalStack и укажите `GOOGLE_DRIVE_EMULATOR_URL` (пример: `http://localhost:9000`).
2. Задайте `GOOGLE_DRIVE_EMULATOR_ROOT` (папка верхнего уровня). Файл будет создан при первой загрузке.
3. Оставьте пустыми `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` и `GOOGLE_DRIVE_SHARED_DRIVE_ID`.
4. Для реального Google Drive очистите переменные эмулятора и добавьте сервисный аккаунт.

Дополнительные шаги и требования к сервисному аккаунту описаны в [`docs/local-setup.md`](../../docs/local-setup.md#google-drive-сервисный-аккаунт).
