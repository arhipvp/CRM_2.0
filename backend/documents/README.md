# Documents Service

Сервис управляет метаданными клиентских документов, очередями загрузки и синхронизации с локальным/self-hosted файловым хранилищем и предоставляет REST API
для других доменов CRM.【F:docs/architecture.md†L15-L18】

## Основные возможности
- CRUD API по метаданным документов (`/documents`).
- REST API для генерации и выдачи каталогов в локальном хранилище (`/api/v1/folders`).
- Фоновые задачи BullMQ для загрузки (`documents.upload`) и синхронизации (`documents.sync`) файлов.
- Очередь BullMQ `documents.permissions.sync` для синхронизации прав доступа на каталогах хранилища.
- Хранение файлов на выделенном томе с генерацией относительных путей (контроль квоты пока не реализован).
- Безопасная работа с пустыми или отсутствующими метаданными: сервис объединяет данные хранилища с исходными значениями, избегая ошибок
  сериализации.
- TypeORM миграции схемы `documents` и изолированное подключение к PostgreSQL.

## Требования к окружению
- Node.js 20 LTS, pnpm 9+ (`corepack prepare pnpm@9 --activate`).
- PostgreSQL (схема `documents`) с включённой функцией `gen_random_uuid()` (расширение `pgcrypto` автоматически создаётся миграциями, вручную его добавлять не требуется).
- Redis 6+ для очередей BullMQ.
- POSIX-совместимое хранилище (ext4/xfs/зашифрованный том), примонтированное в путь `DOCUMENTS_STORAGE_ROOT` и доступное для пользователя сервиса.
- Установленные утилиты `acl` (для `setfacl/getfacl`), `attr` и инструмент бэкапа (`rsync`, `restic`, `rclone` — зависит от выбранной стратегии).
- При использовании S3-совместимых бакетов — установленный `s3fs`/`goofys` и unit `systemd`, обеспечивающий автоматическое монтирование.
- Доступный том/каталог с нужным объёмом диска, подготовленный по инструкции в [`docs/local-setup.md`](../../docs/local-setup.md#интеграции).

Минимальный набор переменных окружения описан в [`env.example`](../../env.example) и валидируется при старте. Обратите внимание на `DOCUMENTS_RUN_MIGRATIONS` — переменная управляет автоматическим применением миграций при запуске API/воркера.

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
| `pnpm start:worker` | Отдельный воркер BullMQ (обрабатывает очереди загрузки/синхронизации/очистки). |
| `pnpm build` | Сборка в `dist/`. |
| `pnpm test:e2e` | E2E-тестирование `/health`. |

> В development-режиме API и воркер можно запускать параллельно (`pnpm start:dev` + `pnpm start:worker:dev`).

### Ручная обработка очереди `documents.permissions.sync`

1. Экспортируйте переменные окружения (или загрузите `.env`), чтобы `bullmq` получил доступ к Redis и настройкам очереди.
2. Запустите штатный воркер синхронизации прав: `pnpm start:worker` для production-сборки или `pnpm start:worker:dev` в разработке. Он автоматически снимет задания из очереди `documents.permissions.sync` и применит ACL.
3. Если автоматический воркер недоступен, администратор может обработать очередь вручную: подключитесь к Redis, получите нужное задание через `bullmq` (`Queue.getJob(jobId)` в интерактивной сессии `node`/`ts-node`), примените права с помощью `setfacl`/`chmod` на файловой системе и завершите задачу, обновив статус в таблице `permissions_sync_tasks` (через REST или `UPDATE ... SET completed_at = NOW()` в БД).
4. После завершения убедитесь, что повторные вызовы API возвращают актуальный `status=completed`, и при необходимости удалите задание из очереди (`Queue.remove(jobId)`).

## Конфигурация
| Переменная | Назначение |
| --- | --- |
| `DOCUMENTS_DATABASE_URL` | Подключение к PostgreSQL со схемой `documents`. |
| `DOCUMENTS_DATABASE_SCHEMA` | Имя схемы (по умолчанию `documents`). |
| `DOCUMENTS_RUN_MIGRATIONS` | Автоматически применять миграции при старте (false по умолчанию). |
| `DOCUMENTS_REDIS_URL` | Redis для BullMQ. |
| `DOCUMENTS_REDIS_PREFIX` | Префикс ключей Redis (по умолчанию `documents`). |
| `DOCUMENTS_QUEUE_NAME` | Имя очереди BullMQ (по умолчанию `documents_tasks`, не содержит двоеточий). |
| `DOCUMENTS_PERMISSIONS_SYNC_QUEUE_NAME` | Имя очереди синхронизации прав (по умолчанию `documents.permissions.sync`, не содержит двоеточий). |
| `DOCUMENTS_PERMISSIONS_SYNC_JOB_TTL` | TTL задания синхронизации прав в очереди (секунды, по умолчанию 300). |
| `DOCUMENTS_UPLOAD_URL_BASE` | Базовый URL файлового шлюза для формирования подписанной ссылки. |
| `DOCUMENTS_UPLOAD_URL_TTL` | Время жизни подписанной ссылки на загрузку (секунды, по умолчанию 900). |
| `DOCUMENTS_FOLDERS_TEMPLATE_*` | Шаблоны названий каталогов по типам (`{title}`, `{ownerId}`, `{ownerType}`). |
| `DOCUMENTS_FOLDERS_WEB_BASE_URL` | Базовый URL для генерации ссылок на каталог (reverse-proxy/файловый браузер). |
| `DOCUMENTS_STORAGE_ROOT` | Абсолютный путь к корневому каталогу документов на сервере. |
| `DOCUMENTS_STORAGE_USER` | Системный пользователь-владелец каталога (по умолчанию `crm-docs`). |
| `DOCUMENTS_STORAGE_GROUP` | Основная группа, назначаемая папкам и файлам (например, `crm-sales`). |
| `DOCUMENTS_STORAGE_DEFAULT_MODE` | Маска прав, применяемая при создании каталогов (например, `0770`). |
| `DOCUMENTS_STORAGE_ACL_ENABLED` | Включение расширенных ACL (true/false). |
| `DOCUMENTS_BACKUP_STRATEGY` | Текстовое описание выбранной стратегии бэкапа (`rsync`, `restic`, `snapshot`). |
| `DOCUMENTS_BACKUP_TARGET` | Путь/URL для выгрузки бэкапов (ssh://, s3:// и т.п.). |

> Имя очередей (`queues.documents`, `queues.permissionsSync.name`) сервис получает из `ConfigService` после применения схемы валидации, поэтому значения в `.env` проходят проверку и подставляются вместе со значениями по умолчанию. BullMQ использует имя очереди при формировании ключей Redis, поэтому в названиях запрещены двоеточия (:).

## Права доступа и пользователи

Documents сопоставляет пользователей CRM с системными группами. Сервис ожидает, что:

1. Пользователь, под которым работает процесс (например, `crm-docs`), входит в группы, соответствующие ролям доступа (`crm-sales`, `crm-ops`).
2. Каталог `DOCUMENTS_STORAGE_ROOT` принадлежит пользователю `DOCUMENTS_STORAGE_USER` и группе `DOCUMENTS_STORAGE_GROUP`.
3. При включённых ACL сервис вызывает `setfacl`, чтобы расширить права на папку.

Пример подготовки окружения на Ubuntu:
```bash
sudo useradd --system --home /var/lib/crm-docs --shell /usr/sbin/nologin crm-docs
sudo groupadd crm-sales
sudo usermod -a -G crm-sales crm-docs
sudo mkdir -p /var/lib/crm/documents
sudo chown crm-docs:crm-sales /var/lib/crm/documents
sudo chmod 0770 /var/lib/crm/documents
# Дополнительные группы для доступа исполнителей
sudo groupadd crm-ops
sudo setfacl -m g:crm-ops:rwx /var/lib/crm/documents
```

При синхронизации прав сервис строит ACL на основании списка пользователей. Для диагностики используйте `getfacl <путь>`.

## REST API
- `GET /health` — состояние сервиса.
- `POST /api/v1/folders` — создаёт каталог внутри `DOCUMENTS_STORAGE_ROOT` и сохраняет связь с сущностью. Ответ содержит относительный путь (`folder_path`), абсолютный путь (`full_path`) и публичную ссылку (`public_url`, если публикация настроена). Ошибки: `400 validation_error`, `409 folder_exists`.
- `GET /api/v1/folders/:ownerType/:ownerId` — возвращает метаданные каталога: относительный путь, абсолютный путь (`full_path`) и публичную ссылку (`public_url`, может быть `null`). Ошибка `404 folder_not_found`, если запись отсутствует.
- `GET /documents` — список документов (фильтры по статусу, владельцу, типу, полнотекстовый поиск по названию/описанию, пагинация через `offset`/`limit`; общее количество возвращается в заголовке `X-Total-Count`).
- `GET /documents/:id` — детали документа.
- `POST /documents` — создать запись, получить `upload_url` и `expires_in`. По умолчанию добавляет задание `documents.upload`.
- `PATCH /documents/:id` — обновить метаданные.
- `DELETE /documents/:id` — мягкое удаление: запись помечается как удалённая, `storageService.revokeDocument` удаляет файл из хранилища, без постановки задач в очереди и без пересборки ACL. Повторный вызов вернёт `409 already_deleted`.
- `POST /documents/:id/upload` — переотправить документ в очередь загрузки (повторная выдача подписанного URL).
- `POST /documents/:id/complete` — подтвердить завершение загрузки, зафиксировать размер/хэш и поставить задачу синхронизации (`documents.sync`).
- `POST /documents/:id/sync` — актуализировать метаданные из файловой системы или объектного хранилища.
- `POST /api/v1/permissions/sync` — поставить задачу `documents.permissions.sync` на применение POSIX-прав/ACL для каталога. Ошибки: `400 validation_error`, `404 folder_not_found`.

## Локальное файловое хранилище

1. Подготовьте каталог на хосте и примонтируйте его в контейнер/Pod согласно [docs/local-setup.md](../../docs/local-setup.md#интеграции). Для разработки достаточно `./var/documents`, на VPS используйте отдельный диск (`/srv/crm/documents`).
2. Выставьте права доступа: UID/GID пользователя процесса (`docker compose run --rm documents id`) и/или `fsGroup` в Kubernetes. При включённом SELinux добавьте контекст `:Z` и проверьте AppArmor-политику.
3. Настройте `.env`:
   ```dotenv
   DOCUMENTS_STORAGE_DRIVER=local
   DOCUMENTS_STORAGE_ROOT=/var/lib/crm/documents
   DOCUMENTS_STORAGE_QUOTA_MB=20480     # пример целевого ограничения 20 ГБ (значение пока не применяется кодом)
   DOCUMENTS_STORAGE_PUBLIC_BASE_URL=https://files.crm.local/documents
   ```
   Публичный URL можно оставить пустым — тогда скачивание выполняется через API Documents или защищённый reverse-proxy.
4. Планируйте бэкапы: каталоги с файлами и база `documents` должны резервироваться вместе (см. раздел про резервное копирование в `docs/local-setup.md`).

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

## Пример конфигурации VPS

**Структура каталогов**
```text
/var/lib/crm/documents/
├── clients/
│   └── 0c3d-...-1a2b/
│       ├── deal-42/
│       │   ├── attachments/
│       │   └── policies/
│       └── payments/
└── policies/
    └── P-2025-0001/
```
Каталоги `clients`, `deals`, `policies` создаются автоматически по шаблонам, права по умолчанию — `0770`, владелец `crm-docs:crm-sales`.

**systemd unit для монтирования S3-тома через s3fs**
```ini
[Unit]
Description=Mount CRM documents bucket
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/s3fs crm-docs-bucket /var/lib/crm/documents -o rw,_netdev,allow_other,uid=%i,gid=crm-sales,umask=007
ExecStop=/bin/fusermount -u /var/lib/crm/documents
User=crm-docs
Group=crm-sales

[Install]
WantedBy=multi-user.target
```
Активируйте unit командой `sudo systemctl enable --now documents-mount@$(id -u crm-docs).service`.

**Рекомендации по резервному копированию**
```bash
# Дифференциальный бэкап в S3 каждые 4 часа
restic -r s3:https://backup.example.com/crm-docs backup /var/lib/crm/documents
# Проверка целостности раз в сутки
restic -r s3:https://backup.example.com/crm-docs check
# Локальный снапшот перед обновлением
rsync -a --delete /var/lib/crm/documents/ /srv/backup/crm-docs-$(date +%Y%m%d)
```
Настройте cron/systemd timer в соответствии с политикой бэкапов. Значения `DOCUMENTS_BACKUP_STRATEGY` и `DOCUMENTS_BACKUP_TARGET` отражают выбранный сценарий и синхронизируются с Backup-сервисом.
## Проверка хранилища
- `GET /health` возвращает статус `storage.ok=true`, если каталог из `DOCUMENTS_STORAGE_ROOT` доступен для записи.
- `pnpm start:worker:dev` пишет диагностические события в очередь `documents_tasks`. При ошибках прав доступа воркер выводит код `EACCES` — проверьте UID/GID и параметры монтирования.
- Для анализа свободного места используйте `docker compose exec documents df -h /var/lib/crm/documents` или аналогичную команду в Kubernetes (`kubectl exec`).
### Коды ошибок Documents API

**Применение ACL для выдачи временного доступа подрядчику**
```bash
# Дать группе crm-contractors доступ на чтение к каталогу сделки
sudo setfacl -m g:crm-contractors:rx /var/lib/crm/documents/deals/8b77-...-ddc1
# Ограничить доступ после завершения работ
sudo setfacl -x g:crm-contractors /var/lib/crm/documents/deals/8b77-...-ddc1
```

Дополнительные шаги и требования к локальной среде описаны в [`docs/local-setup.md`](../../docs/local-setup.md#интеграции).

## Дальнейшие шаги

- Реализовать сервисный модуль контроля дисковой квоты: отслеживать общий размер файлов в `DOCUMENTS_STORAGE_ROOT`, сравнивать с `DOCUMENTS_STORAGE_QUOTA_MB` и отправлять события/алерты при превышении порога.
- Добавить периодическую задачу воркера BullMQ, которая будет инициировать проверку квоты и помечать новые загрузки как заблокированные, если лимит превышен.
- Обновить API загрузки документов, чтобы оно учитывало текущее состояние квоты и возвращало пользователям корректные сообщения об ограничениях.
