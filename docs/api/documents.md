# Documents API

## Общая информация
- **Базовый URL:** `https://documents.internal/api/v1`
- **Аутентификация:** сервисный JWT, операции загрузки требуют scope `documents.write`
- **Назначение:** управление метаданными файлов, синхронизация с серверным хранилищем (локальные каталоги или примонтированный том), контроль доступа на уровне файловой системы.

## Папки и структура

### POST `/api/v1/folders`
Создаёт каталог в файловой системе для клиента/сделки/полиса (внутри `DOCUMENTS_STORAGE_ROOT`).

> Название формируется из шаблонов `DOCUMENTS_FOLDERS_TEMPLATE_*`. Доступные плейсхолдеры: `{title}`, `{ownerId}`, `{ownerType}`. Путь строится как `<DOCUMENTS_STORAGE_ROOT>/<owner_type>/<slug по шаблону>`.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| owner_type | string | Да | `client`, `deal`, `policy`, `payment`. |
| owner_id | UUID | Да | ID сущности. |
| title | string | Да | Название папки. |
| parent_folder_path | string | Нет | Относительный путь родительского каталога (например, `clients/uuid`). |

**Ответ 201**
```json
{
  "folder_path": "clients/uuid",
  "absolute_path": "/var/lib/crm/documents/clients/uuid",
  "web_link": "https://files.crm.local/clients/uuid"
}
```

**Ошибки:** `400 validation_error`, `404 owner_not_found`, `409 folder_exists`.

### GET `/api/v1/folders/{owner_type}/{owner_id}`
Возвращает метаданные каталога сущности.

**Ответ 200** — `{ "folder_path": "...", "absolute_path": "...", "web_link": "...", "fs_mode": "0750", "fs_owner": "crm-docs" }`.

**Ошибки:** `404 folder_not_found`.

## Документы

### POST `/documents`
Регистрирует документ и загружает файл через подписанный URL.

**Шаги:**
1. Сервис вызывает `/documents` для регистрации метаданных.
2. В ответе возвращается `upload_url` и `document_id`.
3. Клиент загружает файл по `upload_url` (PUT к объектному хранилищу).
4. После загрузки вызывается `/documents/{document_id}/complete`.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| owner_type | string | Да | Уровень привязки (`client`, `deal`, `policy`, `payment`). |
| owner_id | UUID | Да | ID сущности. |
| title | string | Да | Название документа. |
| document_type | string | Нет | Тип (полис, акт и т.п.). |
| notes | string | Нет | Примечание. |
| tags | array[string] | Нет | Свободные метки. |

**Ответ 201**
```json
{
  "document_id": "uuid",
  "upload_url": "https://storage/...",
  "expires_in": 900
}
```

`expires_in` совпадает со значением `DOCUMENTS_UPLOAD_URL_TTL` (в секундах). `upload_url` — подписанная ссылка для одноразовой загрузки файла в файловый шлюз (HTTP/S3 совместимый endpoint), который сохраняет данные под каталоги `DOCUMENTS_STORAGE_ROOT`.

**Ошибки:** `400 validation_error`, `404 owner_not_found`.

### POST `/documents/{document_id}/complete`
Подтверждает успешную загрузку файла.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| fileSize | integer | Да | Размер загруженного файла в байтах. |
| checksum | string | Да | Хэш файла в шестнадцатеричном виде (MD5/SHA256 — зависит от клиента). |

**Ответ 200** — документ переводится в статус `uploaded`, сохраняются размер и контрольная сумма. После подтверждения сервис ставит задачу синхронизации (`POST /documents/{document_id}/sync`), которая проверяет наличие файла на диске, нормализует права (`chmod/chown`) и обновляет ссылки на каталог.

**Ошибки:**
- `404 document_not_found` — документ не найден или был помечен удалённым (`{"statusCode":404,"code":"document_not_found","message":"Документ {document_id} не найден"}`).
- `409 upload_conflict` — документ уже подтверждён/финализирован. Ответ содержит статус в деталях (`{"statusCode":409,"code":"upload_conflict","message":"Документ {document_id} уже находится в статусе {status}","details":{"status":"synced"}}`).

### GET `/documents`
Поиск документов.

**Параметры запроса**
| Имя | Тип | Описание |
| --- | --- | --- |
| owner_id | UUID | Фильтр по сущности (`metadata.ownerId`). |
| owner_type | string | Ограничение на тип (`metadata.ownerType`). |
| document_type | array[string] | Фильтр по типу документа (`metadata.documentType`). Можно передавать массив параметров `document_type[]=...` или через запятую. |
| search | string | Поиск по названию, описанию и заметкам (`metadata.notes`). |
| limit | integer | По умолчанию 25, максимум 200. |
| offset | integer | Смещение с начала списка (по умолчанию 0). |

**Ответ 200** — массив документов с метаданными (мягко удалённые записи не возвращаются).

> Заголовок `X-Total-Count` содержит общее количество записей без учёта пагинации.

### DELETE `/documents/{document_id}`
Помечает документ удалённым (soft delete), отзывает доступ (удаляет ACL/группы, связанные симлинки) и ставит задачу на очистку бинарного файла из каталога.

**Ответ 204** — без тела. Повторная попытка удалить уже помеченный документ возвращает `409 already_deleted`.

**Ошибки:**
- `404 document_not_found` — запись не найдена (`{"statusCode":404,"code":"document_not_found","message":"Документ {document_id} не найден"}`).
- `409 already_deleted` — документ был ранее удалён (`{"statusCode":409,"code":"already_deleted","message":"Документ {document_id} уже удалён"}`).

## Доступы

### POST `/permissions/sync`
Ставит задачу `documents.permissions.sync` на обновление прав каталога в файловом хранилище (POSIX-права, ACL, группы).

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| owner_type | string | Да | Тип сущности. |
| owner_id | UUID | Да | ID. |
| users | array[string] | Да | Список идентификаторов пользователей (UUID/почта), которые должны получить доступ. На их основе сервис сопоставляет системные группы/UID. |

**Ответ 202**
```json
{
  "job_id": "bullmq-job-id",
  "task_id": "permissions-task-id",
  "effective_mode": "770",
  "applied_acl": [
    {
      "principal": "crm-sales",
      "permissions": ["r", "w", "x"]
    }
  ]
}
```

`job_id` соответствует идентификатору задания BullMQ, `task_id` — записи в таблице `permissions_sync_tasks`. `effective_mode` отражает итоговый POSIX-режим каталога, `applied_acl` — список правил, применённых в ходе синхронизации. TTL задания в очереди регулируется переменной `DOCUMENTS_PERMISSIONS_SYNC_JOB_TTL` (в секундах).

**Ошибки:** `400 validation_error`, `404 folder_not_found`.

## Стандартные ошибки Documents API

| Код | Сообщение | Описание |
| --- | --- | --- |
| 400 | `validation_error` | Ошибка входных данных. |
| 401 | `unauthorized` | Неверный токен. |
| 403 | `forbidden` | Нет прав на работу с папкой. |
| 404 | `document_not_found` | Документ не найден или удалён. |
| 409 | `upload_conflict`/`already_deleted` | Конфликт состояния (повторное подтверждение загрузки или удаление). |
| 413 | `file_too_large` | Файл превышает допустимый размер. |
| 500 | `internal_error` | Внутренняя ошибка сервиса. |
