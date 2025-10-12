# CRM / Deals API

## Общая информация
- **Базовый URL:** `https://crm.internal/api/v1`
- **Аутентификация:** сервисный JWT от Gateway/Auth (`Authorization: Bearer <token>`)
- **Назначение:** управление клиентами, сделками, расчётами, полисами, журналами и связанными задачами.
- **Идемпотентность:** операции создания поддерживают заголовок `Idempotency-Key` (UUID).

## Клиенты

### GET `/clients`
Список клиентов с фильтрами.

**Параметры запроса**
| Имя | Тип | Описание |
| --- | --- | --- |
| search | string | Поиск по имени, ИНН, контактам. |
| status | array[string] | Фильтр по статусу (`potential`, `active`, `inactive`). |
| type | array[string] | `individual` или `company`. |
| limit | integer | По умолчанию 25, максимум 200. |
| offset | integer | Постраничное смещение. |

**Ответ 200** — массив клиентов с основными полями и контактами.

### POST `/clients`
Создаёт клиента.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| type | string | Да | `individual` или `company`. |
| full_name | string | Да | Полное имя/наименование. |
| short_name | string | Нет | Краткое имя. |
| tax_number | string | Нет | ИНН/ИНП. |
| registration_number | string | Нет | Регистрационный номер. |
| segment | string | Нет | Сегмент клиента. |
| status | string | Да | `potential`, `active`, `inactive`. |
| contacts | array<object> | Нет | См. структуру доменной модели. |
| notes | string | Нет | Примечания. |

**Ответ 201** — созданный клиент с `id`.

**Ошибки:** `400 validation_error`, `409 client_exists`.

### PATCH `/clients/{client_id}`
Обновляет данные клиента.

**Параметры пути:** `client_id` — UUID.

**Тело запроса:** любые поля из модели клиента.

**Ответ 200** — обновлённый клиент.

**Ошибки:** `404 client_not_found`.

## Сделки

### GET `/deals`
Возвращает сделки с пагинацией.

**Параметры**
| Имя | Тип | Описание |
| --- | --- | --- |
| client_id | UUID | Фильтр по клиенту. |
| status | array[string] | Фильтр по статусу сделки (`draft`, `estimating`, `awaiting_client`, `issuing`, `active`, `closed`). |
| sales_agent_id | UUID | Фильтр по ответственному агенту. |
| search | string | Поиск по названию/журналу. |
| limit | integer | По умолчанию 25. |
| offset | integer | Смещение. |

**Ответ 200** — массив сделок с базовыми полями и ключевыми связями.

### POST `/deals`
Создаёт сделку с базовыми сущностями.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| client_id | UUID | Да | Клиент сделки. |
| title | string | Да | Название сделки. |
| description | string | Нет | Описание. |
| sales_agent_id | UUID | Да | Ответственный агент. |
| executor_id | UUID | Нет | Назначенный исполнитель. |
| expected_close_date | date | Нет | Плановая дата завершения. |
| tags | array[string] | Нет | Пользовательские теги. |

**Ответ 201**
```json
{
  "id": "uuid",
  "status": "draft",
  "folder_id": "drive-folder",
  "created_at": "2024-02-18T07:45:00Z"
}
```

**Ошибки:** `400 validation_error`, `404 client_not_found`, `409 deal_conflict` (активная сделка с тем же клиентом и названием).

### PATCH `/deals/{deal_id}`
Обновляет реквизиты сделки (статус, исполнители, описание).

**Параметры пути:** `deal_id` — UUID.

**Тело запроса** — частичное обновление по полям `title`, `description`, `status`, `sales_agent_id`, `executor_id`, `expected_close_date`.

**Ответ 200** — обновлённая сделка.

**Ошибки:** `400 invalid_status_transition`, `404 deal_not_found`.

### POST `/deals/{deal_id}/journal`
Добавляет запись в журнал.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| text | string | Да | Текст заметки. |
| attachments | array<string> | Нет | Ссылки на документы. |

**Ответ 201** — запись журнала.

**Ошибки:** `404 deal_not_found`.

## Расчёты и полисы

### POST `/deals/{deal_id}/calculations`
Добавляет расчёт по сделке.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| insurance_company | string | Да | Название страховой компании. |
| program_name | string | Нет | Программа страхования. |
| premium_amount | number | Нет | Премия. |
| coverage_sum | number | Нет | Сумма покрытия. |
| calculation_date | date | Да | Дата расчёта. |
| validity_period | object | Нет | `{ "from": "2024-02-01", "to": "2024-03-01" }`. |
| files | array<string> | Нет | Ссылки на документы. |
| comments | string | Нет | Комментарии. |

**Ответ 201** — расчёт с `id`.

**Ошибки:** `404 deal_not_found`.

### POST `/deals/{deal_id}/policies`
Создаёт полис.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| calculation_id | UUID | Нет | Связанный расчёт. |
| policy_number | string | Да | Номер полиса. |
| insurer | string | Да | Страховая компания. |
| program_name | string | Нет | Программа. |
| effective_from | date | Да | Дата начала действия. |
| effective_to | date | Да | Дата окончания. |
| premium_amount | number | Да | Сумма премии. |
| coverage_sum | number | Нет | Сумма покрытия. |
| status | string | Да | `draft`, `active`, `renewal_due`, `closed`. |
| documents | array<string> | Нет | Ссылки на документы. |

**Ответ 201** — созданный полис.

**Ошибки:** `400 validation_error`, `404 deal_not_found`, `409 policy_conflict` (дублирующий номер).

### PATCH `/policies/{policy_id}`
Обновляет статус и реквизиты полиса.

**Тело запроса** — поля `status`, `effective_to`, `documents`, `premium_amount`, `coverage_sum`.

**Ответ 200** — обновлённый полис.

**Ошибки:** `400 invalid_status_transition`, `404 policy_not_found`.

## Платежи (домен CRM)

CRM хранит метаданные платежей для воронки и синхронизации с Payments.

### GET `/payments`
Список платежей по сделке/полису.

**Параметры запроса**
| Имя | Тип | Описание |
| --- | --- | --- |
| deal_id | UUID | Фильтр по сделке. |
| policy_id | UUID | Фильтр по полису. |
| status | array[string] | `planned`, `expected`, `received`, `paid_out`, `cancelled`. |

**Ответ 200** — список платежей с ссылкой на `payments` сервис через `external_ref`.

### POST `/payments`
Создаёт запись о платеже (план или факт).

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| deal_id | UUID | Да | Связанная сделка. |
| policy_id | UUID | Да | Связанный полис. |
| payment_type | string | Да | `client_premium`, `commission_income`, `client_discount`, `executor_fee`. |
| planned_date | date | Нет | Плановая дата. |
| amount | number | Да | Сумма. |
| currency | string | Да | Валюта, фиксированное значение `RUB` (хранится для совместимости и не поддерживает другие значения). |
| notes | string | Нет | Комментарии. |

**Пример запроса**
```json
{
  "deal_id": "uuid",
  "policy_id": "uuid",
  "payment_type": "client_premium",
  "amount": 12345.67,
  "currency": "RUB"
}
```

**Ответ 201** — созданный платёж с `status = planned`.

**Пример ответа**
```json
{
  "id": "uuid",
  "deal_id": "uuid",
  "policy_id": "uuid",
  "payment_type": "client_premium",
  "status": "planned",
  "amount": 12345.67,
  "currency": "RUB"
}
```

**Ошибки:** `400 validation_error`, `404 deal_not_found`, `404 policy_not_found`.

## Задачи

### POST `/tasks`
Создаёт задачу, связанную со сделкой/полисом/платежом.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| subject | string | Да | Краткое описание. |
| description | string | Да | Подробности. |
| deal_id | UUID | Нет | Связанная сделка. |
| policy_id | UUID | Нет | Связанный полис. |
| payment_id | UUID | Нет | Связанный платёж. |
| assignee_id | UUID | Да | Исполнитель. |
| due_date | date | Нет | Срок. |
| priority | string | Нет | `low`, `normal`, `high`. |

**Ответ 201** — задача.

**Ошибки:** `400 validation_error`, `404 deal_not_found` (если указан `deal_id`).

### PATCH `/tasks/{task_id}`
Обновляет статус задачи (`new` — «Новая», `in_progress` — «В работе», `waiting` — «В ожидании», `done` — «Выполнена», `cancelled` — «Отменена») и фактические даты.

**Ответ 200** — обновлённая задача.

**Ошибки:** `404 task_not_found`, `409 invalid_status_transition`.

## Стандартные ошибки CRM / Deals API

| Код | Сообщение | Описание |
| --- | --- | --- |
| 400 | `validation_error` | Нарушение схемы данных или бизнес-правил. |
| 401 | `unauthorized` | Неверный токен сервиса. |
| 403 | `forbidden` | Недостаточно прав (например, попытка доступа к чужой сделке). |
| 404 | `not_found` | Ресурс не найден. |
| 409 | `conflict` | Конфликт версий или дублирование. |
| 412 | `precondition_failed` | Не удовлетворены предусловия (например, неподтверждён клиент). |
| 500 | `internal_error` | Внутренняя ошибка. |
