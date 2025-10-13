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

**Тело запроса** (поддерживаются как `camelCase`, так и `snake_case` имена полей)
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| external_ref | string | Нет | ID в CRM (для синхронизации). |
| deal_id | UUID | Да | Связь со сделкой. |
| policy_id | UUID | Да | Связь с полисом. |
| payment_type | string | Да | Тип платежа. |
| planned_date | date | Нет | Плановая дата. |
| amount | number | Да | Сумма. |
| currency | string | Да | Валюта, фиксированное значение `RUB` (используется для совместимости, запросы с другой валютой завершаются ошибкой `400 validation_error`). |
| direction | string | Да | `inbound` или `outbound`. |
| notes | string | Нет | Примечание. |

**Пример запроса**
```json
{
  "external_ref": "crm-payment-id",
  "deal_id": "uuid",
  "policy_id": "uuid",
  "payment_type": "client_premium",
  "planned_date": "2024-06-20",
  "amount": 12345.67,
  "currency": "RUB",
  "direction": "inbound"
}
```

**Ответ 201** — созданный платёж со статусом `planned`.

**Пример ответа**
```json
{
  "id": "uuid",
  "external_ref": "crm-payment-id",
  "deal_id": "uuid",
  "policy_id": "uuid",
  "payment_type": "client_premium",
  "status": "planned",
  "amount": 12345.67,
  "currency": "RUB",
  "direction": "inbound"
}
```

**Ошибки:** `400 validation_error`, `409 duplicate_payment` (по `external_ref`).

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

**Ошибки:** `404 payment_not_found`.

### POST `/payments/{payment_id}/status`
Переводит платёж в новый статус.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| status | string | Да | Новый статус. |
| actual_date | date | Нет | Дата фактического события (обязательно для `received` и `paid_out`). |
| confirmation_reference | string | Нет | Номер платёжного документа. |
| comment | string | Нет | Примечание. |

**Ответ 200** — текущий платёж с историей.

**Ошибки:** `400 invalid_status_transition`, `404 payment_not_found`.

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
| payload | object | Да | Структура платежа из CRM. |
| signature | string | Да | HMAC-подпись. |

**Ответ 202** — запись принята для обработки.

**Ошибки:** `400 invalid_signature`, `409 stale_update` (версия устарела).

## Стандартные ошибки Payments API

| Код | Сообщение | Описание |
| --- | --- | --- |
| 400 | `validation_error` | Ошибка валидации или бизнес-правил. |
| 401 | `unauthorized` | Неверный токен. |
| 403 | `forbidden` | Нет прав на операцию. |
| 404 | `not_found` | Платёж/ресурс не найден. |
| 409 | `conflict` | Конфликт версий. |
| 500 | `internal_error` | Внутренняя ошибка сервиса. |
