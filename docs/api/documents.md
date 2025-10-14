# Documents API

## Общая информация
- **Базовый URL:** `https://documents.internal/api/v1`
- **Аутентификация:** сервисный JWT, операции загрузки требуют scope `documents.write`
- **Назначение:** управление метаданными файлов, синхронизация с Google Drive, контроль доступа.

## Папки и структура

### POST `/api/v1/folders`
Создаёт папку на Google Drive для клиента/сделки/полиса.

> Название формируется из шаблонов `DOCUMENTS_FOLDERS_TEMPLATE_*`. Доступные плейсхолдеры: `{title}`, `{ownerId}`, `{ownerType}`.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| owner_type | string | Да | `client`, `deal`, `policy`, `payment`. |
| owner_id | UUID | Да | ID сущности. |
| title | string | Да | Название папки. |
| parent_folder_id | string | Нет | Родительская папка в Drive. |

**Ответ 201**
```json
{
  "folder_id": "drive-folder-id",
  "web_link": "https://drive.google.com/..."
}
```

**Ошибки:** `400 validation_error`, `404 owner_not_found`, `409 folder_exists`.

### GET `/api/v1/folders/{owner_type}/{owner_id}`
Возвращает метаданные папки сущности.

**Ответ 200** — `{ "folder_id": "...", "web_link": "..." }`.

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

`expires_in` совпадает со значением `DOCUMENTS_UPLOAD_URL_TTL` (в секундах). `upload_url` — подписанная ссылка для одноразовой загрузки файла в объектное хранилище.

**Ошибки:** `400 validation_error`, `404 owner_not_found`.

### POST `/documents/{document_id}/complete`
Подтверждает успешную загрузку файла.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| fileSize | integer | Да | Размер загруженного файла в байтах. |
| checksum | string | Да | Хэш файла в шестнадцатеричном виде (MD5/SHA256 — зависит от клиента). |

**Ответ 200** — документ переводится в статус `uploaded`, сохраняются размер и контрольная сумма. После подтверждения сервис ставит задачу синхронизации (`POST /documents/{document_id}/sync`).

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
Помечает документ удалённым (soft delete) и отзываёт доступ в Drive.

**Ответ 204** — без тела. Повторная попытка удалить уже помеченный документ возвращает `409 already_deleted`.

**Ошибки:**
- `404 document_not_found` — запись не найдена (`{"statusCode":404,"code":"document_not_found","message":"Документ {document_id} не найден"}`).
- `409 already_deleted` — документ был ранее удалён (`{"statusCode":409,"code":"already_deleted","message":"Документ {document_id} уже удалён"}`).

## Доступы

### POST `/permissions/sync`
Синхронизирует доступы пользователей в папке с актуальными ролями.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| owner_type | string | Да | Тип сущности. |
| owner_id | UUID | Да | ID. |
| users | array<object> | Да | Массив `{ "user_id": "uuid", "role": "viewer|editor" }`. |

**Ответ 202** — задача синхронизации поставлена в очередь.

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
