# Documents Service

Сервис управляет метаданными клиентских документов, очередями загрузки и синхронизации с локальным/self-hosted файловым хранилищем и предоставляет REST API
для других доменов CRM.【F:docs/architecture.md†L15-L18】

## Основные возможности
- CRUD API по метаданным документов (`/documents`).
- REST API для генерации и выдачи каталогов в локальном хранилище (`/api/v1/folders`).
- Фоновые задачи BullMQ для загрузки (`documents.upload`) и синхронизации (`documents.sync`) файлов.
- Очередь BullMQ `documents.permissions.sync` для синхронизации прав доступа на каталогах хранилища.
- Хранение файлов на выделенном томе с контролем квоты и генерацией относительных путей.
- Безопасная работа с пустыми или отсутствующими метаданными: сервис объединяет данные хранилища с исходными значениями, избегая ошибок
  сериализации.
- TypeORM миграции схемы `documents` и изолированное подключение к PostgreSQL.

## Требования к окружению
- Node.js 20 LTS, pnpm 9+ (`corepack prepare pnpm@9 --activate`).
- PostgreSQL (схема `documents`) с включённой функцией `gen_random_uuid()` (`CREATE EXTENSION IF NOT EXISTS pgcrypto`).
- Redis 6+ для очередей BullMQ.
- Доступный том/каталог с нужным объёмом диска, подготовленный по инструкции в [`docs/local-setup.md`](../../docs/local-setup.md#интеграции).

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
| `DOCUMENTS_PERMISSIONS_SYNC_QUEUE_NAME` | Имя очереди синхронизации прав (по умолчанию `documents.permissions.sync`). |
| `DOCUMENTS_PERMISSIONS_SYNC_JOB_TTL` | TTL задания синхронизации прав в очереди (секунды, по умолчанию 300). |
| `DOCUMENTS_UPLOAD_URL_BASE` | Базовый URL объектного хранилища для формирования подписанной ссылки. |
| `DOCUMENTS_UPLOAD_URL_TTL` | Время жизни подписанной ссылки на загрузку (секунды, по умолчанию 900). |
| `DOCUMENTS_FOLDERS_TEMPLATE_*` | Шаблоны названий папок по типам (`{title}`, `{ownerId}`, `{ownerType}`). |
| `DOCUMENTS_FOLDERS_WEB_BASE_URL` | Базовый URL для формирования ссылок на каталоги (совмещается с `DOCUMENTS_STORAGE_PUBLIC_BASE_URL`). |
| `DOCUMENTS_STORAGE_DRIVER` | Драйвер хранения (`local` — файловая система по умолчанию). |
| `DOCUMENTS_STORAGE_ROOT` | Путь внутри контейнера/сервиса, где размещаются файлы. |
| `DOCUMENTS_STORAGE_QUOTA_MB` | Опциональный лимит диска в мегабайтах; `0` или пусто — без ограничения. |
| `DOCUMENTS_STORAGE_PUBLIC_BASE_URL` | Опциональный публичный URL (reverse-proxy/CDN) для скачивания файлов. |

## Локальное файловое хранилище

1. Подготовьте каталог на хосте и примонтируйте его в контейнер/Pod согласно [docs/local-setup.md](../../docs/local-setup.md#интеграции). Для разработки достаточно `./var/documents`, на VPS используйте отдельный диск (`/srv/crm/documents`).
2. Выставьте права доступа: UID/GID пользователя процесса (`docker compose run --rm documents id`) и/или `fsGroup` в Kubernetes. При включённом SELinux добавьте контекст `:Z` и проверьте AppArmor-политику.
3. Настройте `.env`:
   ```dotenv
   DOCUMENTS_STORAGE_DRIVER=local
   DOCUMENTS_STORAGE_ROOT=/var/lib/crm/documents
   DOCUMENTS_STORAGE_QUOTA_MB=20480     # пример ограничения 20 ГБ
   DOCUMENTS_STORAGE_PUBLIC_BASE_URL=https://files.crm.local/documents
   ```
   Публичный URL можно оставить пустым — тогда скачивание выполняется через API Documents или защищённый reverse-proxy.
4. Планируйте бэкапы: каталоги с файлами и база `documents` должны резервироваться вместе (см. раздел про резервное копирование в `docs/local-setup.md`).

## REST API
- `GET /health` — состояние сервиса.
- `POST /api/v1/folders` — создаёт каталог в файловом хранилище и сохраняет связь с сущностью. Ошибки: `400 validation_error`, `409 folder_exists`.
- `GET /api/v1/folders/:ownerType/:ownerId` — возвращает привязанный каталог (относительный путь и публичную ссылку при наличии). Ошибка `404 folder_not_found`, если запись отсутствует.
- `GET /documents` — список документов (фильтрация по статусу, владельцу, типу, полнотекстовый поиск по названию/описанию, пагинация через `offset`/`limit`; ответ — массив, общее количество приходит в заголовке `X-Total-Count`).
- `GET /documents/:id` — детали документа.
- `POST /documents` — создать запись, получить `upload_url` и `expires_in`. По умолчанию добавляет задание `documents.upload`.
- `PATCH /documents/:id` — обновить метаданные.
- `DELETE /documents/:id` — мягкое удаление: запись помечается как удалённая, права доступа отзываются (повторный вызов вернёт `409 already_deleted`).
- `POST /documents/:id/upload` — переотправить документ в очередь загрузки.
- `POST /documents/:id/complete` — подтвердить завершение загрузки и поставить задачу синхронизации.
- `POST /documents/:id/sync` — обновить метаданные из файловой системы/объектного хранилища.
- `POST /api/v1/permissions/sync` — поставить задачу `documents.permissions.sync` на обновление списка пользователей каталога. Ошибки: `400 validation_error`, `404 folder_not_found`.

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
- `1740201600000-create-folders-table.ts` — создаёт таблицу `folders`.
- `1740801600000-create-permissions-sync-tasks.ts` — добавляет таблицу `permissions_sync_tasks`.

## Проверка хранилища
- `GET /health` возвращает статус `storage.ok=true`, если каталог из `DOCUMENTS_STORAGE_ROOT` доступен для записи.
- `pnpm start:worker:dev` пишет диагностические события в очередь `documents:tasks`. При ошибках прав доступа воркер выводит код `EACCES` — проверьте UID/GID и параметры монтирования.
- Для анализа свободного места используйте `docker compose exec documents df -h /var/lib/crm/documents` или аналогичную команду в Kubernetes (`kubectl exec`).
### Коды ошибок Documents API

- `404 document_not_found` — документ не найден или уже удалён (`{"statusCode":404,"code":"document_not_found","message":"Документ {document_id} не найден"}`).
- `409 already_deleted` — повторное удаление ранее помеченного документа (`{"statusCode":409,"code":"already_deleted","message":"Документ {document_id} уже удалён"}`).
- `409 upload_conflict` — попытка подтвердить загрузку документа в финальном статусе (`{"statusCode":409,"code":"upload_conflict","message":"Документ {document_id} уже находится в статусе {status}","details":{"status":"synced"}}`).

