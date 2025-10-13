# Payments API

## Общая информация
- **Базовый URL:** `https://payments.internal/api/v1`
- **Аутентификация:** сервисный JWT + mTLS для критичных операций
- **Назначение:** учёт входящих и исходящих платежей, синхронизация статусов, публикация событий в RabbitMQ.

## Платежи

### Статусы платежей

| Код | Локализация | Описание |
| --- | --- | --- |
| `PENDING` | «В ожидании» | Платёж создан и ожидает обработки. |
| `PROCESSING` | «В обработке» | Платёж находится в обработке сторонними системами. |
| `COMPLETED` | «Завершён» | Платёж успешно проведён. |
| `FAILED` | «Ошибка» | Платёж завершился ошибкой либо отклонён. |
| `CANCELLED` | «Отменён» | Платёж отменён пользователем или системой. |

> Справочник поддерживается в [модели данных](../data-model.md#справочник-статусов-платежей) и используется во всех доменных и API-описаниях.

### Типы платежей

| Код | Локализация | Описание |
| --- | --- | --- |
| `INITIAL` | «Первоначальный взнос» | Базовый платёж при старте сделки. |
| `INSTALLMENT` | «Регулярный платёж» | Платёж в рамках графика/рассрочки. |
| `COMMISSION` | «Комиссия» | Комиссионное вознаграждение CRM или партнёру. |
| `REFUND` | «Возврат» | Возврат средств клиенту. |

> Значения совпадают со справочником `payment_types` (см. миграции сервиса Payments).

### GET `/payments`
Получение списка платежей с фильтрами.

**Параметры запроса**
| Имя | Тип | Описание |
| --- | --- | --- |
| `dealId` | UUID | Фильтр по сделке CRM. |
| `policyId` | UUID | Фильтр по полису. |
| `status`/`statuses` | array[string] | Значения из словаря `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED` (поддерживаются оба имени параметра). |
| `type`/`types` | array[string] | Значения словаря типов (`INITIAL`, `INSTALLMENT`, `COMMISSION`, `REFUND`) (поддерживаются оба имени параметра). |
| `fromDate` | datetime (ISO 8601) | Нижняя граница по `created_at` (включительно). |
| `toDate` | datetime (ISO 8601) | Верхняя граница по `created_at` (включительно). |
| `limit` | integer | Размер страницы (по умолчанию `50`, максимум `200`). |
| `offset` | integer | Смещение, начиная с `0`. |

Ответ представляет собой поток (`Flux`) платежей, отсортированных по `created_at` в порядке убывания. Если заданы `fromDate` и `toDate`, `fromDate` не может быть позднее `toDate`.

**Ответ 200** — массив платежей.

### POST `/payments`
Создаёт запись о платеже.

**Тело запроса** (поддерживаются `snake_case` и `camelCase` имена)
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| deal_id | UUID | Да | Связь со сделкой CRM. |
| policy_id | UUID | Нет | Связь с полисом (если применимо). |
| initiator_user_id | UUID | Да | Пользователь, инициировавший создание платежа. |
| amount | number | Да | Сумма платежа (> 0). |
| currency | string | Да | Поддерживается только значение `RUB` (ISO 4217). |
| payment_type | string | Да | Тип платежа (`INITIAL`, `INSTALLMENT`, `COMMISSION`, `REFUND`). |
| planned_date | datetime (ISO 8601) | Нет | Плановая дата платежа. |
| description | string | Нет | Комментарий/описание. |

**Пример запроса**
```json
{
  "deal_id": "c9a3d829-1adf-4d5c-9b38-9d34c1b79c5f",
  "policy_id": "30a5fcd7-7ca7-4107-8ef4-89c63b8a5cb1",
  "initiator_user_id": "d22d11e4-6a25-4b43-8a7f-7319bf7f685b",
  "amount": 2500.00,
  "currency": "RUB",
  "payment_type": "INSTALLMENT",
  "planned_date": "2024-08-15T12:00:00+03:00",
  "description": "Ежемесячный платёж по рассрочке"
}
```

**Ответ 201** — созданный платёж со статусом `PENDING`.

**Пример ответа**
```json
{
  "id": "11f6a3f5-4a71-46a8-9f32-4e90ac1959fa",
  "dealId": "c9a3d829-1adf-4d5c-9b38-9d34c1b79c5f",
  "policyId": "30a5fcd7-7ca7-4107-8ef4-89c63b8a5cb1",
  "initiatorUserId": "d22d11e4-6a25-4b43-8a7f-7319bf7f685b",
  "amount": 2500.00,
  "currency": "RUB",
  "status": "PENDING",
  "paymentType": "INSTALLMENT",
  "dueDate": "2024-08-15T12:00:00+03:00",
  "createdAt": "2024-07-24T09:30:00Z",
  "updatedAt": "2024-07-24T09:30:00Z"
}
```

**Ошибки:** `400 validation_error` (ошибка валидации входных данных).

### PATCH `/payments/{payment_id}`
Частичное обновление платежа (сумма, валюта, даты, тип и описание). Любое изменённое поле или комментарий фиксируется в истории (`payment_history`) и транслируется наружу событием `payment.updated` (RabbitMQ `payments.events` + SSE `/streams/payments`).

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| amount | number | Нет | Новая сумма платежа (> 0). |
| currency | string | Нет | Валюта ISO 4217, поддерживается только значение `RUB` (любое другое значение отклоняется ошибкой `400 validation_error`). |
| dueDate | datetime (ISO 8601) | Нет | Плановая дата платежа. |
| processedAt | datetime (ISO 8601) | Нет | Фактическая дата обработки. |
| paymentType | string | Нет | Тип платежа (`INITIAL`, `INSTALLMENT`, `COMMISSION`, `REFUND`). |
| description | string | Нет | Пользовательское описание/примечание. |
| comment | string | Нет | Комментарий для истории (сохраняется в `payment_history.description`). |

**Ответ 200** — обновлённый платёж.

**Пример запроса**
```json
{
  "amount": 1250.50,
  "currency": "RUB",
  "comment": "Корректировка суммы"
}
```

**Пример ошибки**
```json
{
  "currency": "USD"
}
```
→ **Ответ 400** с кодом `validation_error` (валюта может быть только `RUB`).

**Ошибки:** `400 validation_error`, `404 payment_not_found`.

### POST `/payments/{payment_id}/status`
Переводит платёж в новый статус.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| status | string | Да | Новый статус (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`). |
| actual_date | datetime | Нет | Фактическая дата события; обязательна для `COMPLETED`. |
| confirmation_reference | string | Нет | Номер платёжного документа (до 128 символов). |
| comment | string | Нет | Служебное примечание (обязательно при переводе в `CANCELLED`). |

Допустимые переходы: `PENDING → PROCESSING/CANCELLED`, `PROCESSING → COMPLETED/FAILED/CANCELLED`, `FAILED → PROCESSING/CANCELLED`, `COMPLETED → CANCELLED`. Возврат из `CANCELLED` невозможен. Любые попытки выйти за пределы этих правил завершаются ошибкой `invalid_status_transition`.

**Ответ 200** — текущий платёж с историей.

**Ошибки:** `400 validation_error`, `400 invalid_status_transition`, `404 payment_not_found`.

## Экспорт и отчёты

### GET `/payments/export`
Генерация CSV/Excel отчёта по фильтрам (асинхронная операция).

**Параметры запроса** — те же, что у `/payments` + `format` (`csv` или `xlsx`).

**Ответ 202**
```json
{
  "job_id": "uuid",
  "status": "processing"
}
```

В результате создаётся задача в очереди RabbitMQ (`payments.exports`).

### GET `/payments/export/{job_id}`
Проверка статуса выгрузки.

**Ответ 200**
```json
{
  "job_id": "uuid",
  "status": "done",
  "download_url": "https://storage/..."
}
```

**Ошибки:** `404 export_not_found`.

## Вебхуки и синхронизация

### POST `/webhooks/crm`
Принимает уведомления от CRM о создании/изменении платежей (для выравнивания данных).

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| event | string | Да | `payment.created` или `payment.updated`. |
| payload | object | Да | Структура платежа из CRM. Для `payment.updated` обязательны поля `paymentId` и версия (`updatedAt` в ISO 8601 или `revision` как миллисекунды Unix-эпохи). |
| signature | string | Да | HMAC-подпись (см. алгоритм ниже). |

**Ответ 202** — запись принята для обработки.

**Ответ 409** — возвращается, если пришёл устаревший payload `payment.updated` (значение `updatedAt` в базе новее переданного либо `revision` меньше актуального). Код ошибки — `stale_update`.

#### Пример `payment.updated`

```json
{
  "event": "payment.updated",
  "payload": {
    "paymentId": "11f6a3f5-4a71-46a8-9f32-4e90ac1959fa",
    "amount": 2500.00,
    "updatedAt": "2024-07-24T10:15:30Z"
  },
  "signature": "..."
}
```

> Если CRM использует числовую версию (`revision`), значение должно представлять собой метку времени в миллисекундах с начала Unix-эпохи. Сервис конвертирует её в UTC и сравнивает с текущим `updated_at` в базе.

**Алгоритм подписи**

- Формируется строка `<event>:<payload_json>`, где `payload_json` — JSON-представление объекта `payload` без дополнительных
  пробелов (по сути `JSON.stringify` в JavaScript или `ObjectMapper.writeValueAsString` в Java).
- Строка подписывается алгоритмом `HMAC-SHA256` с использованием секрета `PAYMENTS_CRM_WEBHOOK_SECRET`.
- Полученный бинарный хэш кодируется в нижнем регистре HEX и передаётся в поле `signature`.

**Ошибки:** `401 invalid_signature`, `400 invalid_payload`, `404 payment_not_found`, `409 stale_update` (версия устарела).

## Стандартные ошибки Payments API

| Код | Сообщение | Описание |
| --- | --- | --- |
| 400 | `validation_error` | Ошибка валидации или бизнес-правил. |
| 401 | `unauthorized` | Неверный токен. |
| 403 | `forbidden` | Нет прав на операцию. |
| 404 | `not_found` | Платёж/ресурс не найден. |
| 409 | `conflict` | Конфликт версий. |
| 500 | `internal_error` | Внутренняя ошибка сервиса. |
