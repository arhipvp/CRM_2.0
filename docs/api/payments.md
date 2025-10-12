# Payments API

## Общая информация
- **Базовый URL:** `https://payments.internal/api/v1`
- **Аутентификация:** сервисный JWT + mTLS для критичных операций
- **Назначение:** учёт входящих и исходящих платежей, синхронизация статусов, публикация событий в RabbitMQ.

## Платежи

### Статусы платежей

| Код | Локализация | Описание |
| --- | --- | --- |
| `planned` | «Запланирован» | Платёж добавлен в график, но счёт ещё не выставлен. |
| `expected` | «Ожидается» | Счёт выставлен, ожидается подтверждение поступления/списания. |
| `received` | «Получен» | Поступление средств на счёт компании подтверждено. |
| `paid_out` | «Выплачен» | Сумма перечислена контрагенту или распределена как комиссия/скидка. |
| `cancelled` | «Отменён» | Платёж отменён или перенесён без движения денег. |

### GET `/payments`
Получение списка платежей с фильтрами.

**Параметры запроса**
| Имя | Тип | Описание |
| --- | --- | --- |
| deal_id | UUID | Фильтр по сделке CRM. |
| policy_id | UUID | Фильтр по полису. |
| status | array[string] | `planned`, `expected`, `received`, `paid_out`, `cancelled`. |
| type | array[string] | Тип платежа. |
| from_date | date | Фильтр по дате плановой/фактической (`>=`). |
| to_date | date | Фильтр по дате (`<=`). |
| limit | integer | По умолчанию 50. |
| offset | integer | Смещение. |

**Ответ 200** — массив платежей.

### POST `/payments`
Создаёт запись о платеже.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| external_ref | string | Нет | ID в CRM (для синхронизации). |
| deal_id | UUID | Да | Связь со сделкой. |
| policy_id | UUID | Да | Связь с полисом. |
| payment_type | string | Да | Тип платежа. |
| planned_date | date | Нет | Плановая дата. |
| amount | number | Да | Сумма. |
| currency | string | Да | Валюта, фиксированное значение `RUB` (используется для совместимости и не поддерживает другие значения). |
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
Обновляет параметры платежа (даты, суммы, направление, тип, комментарии).

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
