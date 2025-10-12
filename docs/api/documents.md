# Documents API

## Общая информация
- **Базовый URL:** `https://documents.internal/api/v1`
- **Аутентификация:** сервисный JWT, операции загрузки требуют scope `documents.write`
- **Назначение:** управление метаданными файлов, синхронизация с Google Drive, контроль доступа.

## Папки и структура

### POST `/folders`
Создаёт папку на Google Drive для клиента/сделки/полиса.

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

### GET `/folders/{owner_type}/{owner_id}`
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

**Ошибки:** `400 validation_error`, `404 owner_not_found`.

### POST `/documents/{document_id}/complete`
Подтверждает успешную загрузку файла.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| file_size | integer | Да | Размер в байтах. |
| checksum | string | Да | SHA256 хэш в hex. |

**Ответ 200** — документ становится доступным в поиске.

**Ошибки:** `404 document_not_found`, `409 upload_not_found` (истек URL).

### GET `/documents`
Поиск документов.

**Параметры запроса**
| Имя | Тип | Описание |
| --- | --- | --- |
| owner_id | UUID | Фильтр по сущности. |
| owner_type | string | Ограничение на тип. |
| document_type | array[string] | Фильтр по типу. |
| search | string | Поиск по названию/заметкам. |
| limit | integer | По умолчанию 50. |
| offset | integer | Смещение. |

**Ответ 200** — список документов с метаданными.

### DELETE `/documents/{document_id}`
Помечает документ удалённым (soft delete) и отзываёт доступ в Drive.

**Ответ 204** — без тела.

**Ошибки:** `404 document_not_found`, `409 already_deleted`.

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
| 404 | `not_found` | Папка/документ не найден. |
| 409 | `conflict` | Конфликт состояния (дубликат, уже загружено). |
| 413 | `file_too_large` | Файл превышает допустимый размер. |
| 500 | `internal_error` | Внутренняя ошибка сервиса. |
