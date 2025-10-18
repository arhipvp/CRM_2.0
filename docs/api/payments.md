# Payments API

## Общая информация
- **Базовый URL:** `https://crm.internal/api/v1`
- **Аутентификация:** пользовательский JWT, выданный Auth API.
- **Назначение:** управление графиком платежей полисов, фиксация поступлений и связанных затрат внутри CRM.
- **Формат данных:** JSON (RFC 8259), числа — `string` в десятичном представлении, если не указано иное.

Платёжный модуль поддерживает несколько записей на один полис. Каждая запись отражает план/факт поступления средств и агрегирует связанные операции (`incomes` и `expenses`). Статус платежа вычисляется на стороне CRM исходя из суммарных поступлений и расходов.

## Структура объектов

### Платёж
| Поле | Тип | Описание |
| --- | --- | --- |
| id | UUID | Уникальный идентификатор платежа. |
| deal_id | UUID | Сделка, к которой относится полис. |
| policy_id | UUID | Полис, к которому относится платёж. |
| sequence | integer | Порядковый номер платежа внутри полиса (начиная с `1`). |
| status | string | `scheduled` \| `partially_paid` \| `paid` \| `cancelled`. |
| planned_date | date (`YYYY-MM-DD`) | Плановая дата платежа. Необязательна. |
| actual_date | date (`YYYY-MM-DD`) | Дата, когда платёж считается закрытым. Устанавливается вручную или вычисляется по сумме поступлений. |
| planned_amount | string (decimal) | Плановая сумма платежа. |
| currency | string | Трёхбуквенный код валюты по ISO 4217. |
| comment | string | Свободный комментарий (до 500 символов). |
| created_by_id | UUID | Пользователь, создавший платёж. |
| updated_by_id | UUID | Пользователь, отредактировавший платёж. |
| recorded_by_id | UUID | Пользователь, вручную подтвердивший закрытие платежа. |
| incomes_total | string (decimal) | Совокупная сумма поступлений. |
| expenses_total | string (decimal) | Совокупная сумма расходов, связанных с платёжной записью. |
| net_total | string (decimal) | Разница `incomes_total - expenses_total`. |
| created_at | datetime (ISO 8601) | Дата и время создания записи. |
| updated_at | datetime (ISO 8601) | Дата и время последнего изменения. |
| incomes | array<object> | Список операций поступлений (опционально, `include[]=incomes`). |
| expenses | array<object> | Список операций расходов (опционально, `include[]=expenses`). |

### Поступление / Расход
| Поле | Тип | Описание |
| --- | --- | --- |
| id | UUID | Уникальный идентификатор операции. |
| payment_id | UUID | Платёж, к которому относится операция. |
| amount | string (decimal) | Абсолютная сумма операции. |
| currency | string | Код валюты. Должен совпадать с валютой платежа. |
| category | string | Произвольная категория (`cash`, `wire`, `agency_fee`, `refund` и т.д.). |
| posted_at | date (`YYYY-MM-DD`) | Дата фиксации операции. Не может быть в будущем. |
| note | string | Комментарий (до 300 символов). |
| created_by_id | UUID | Пользователь, создавший операцию. |
| updated_by_id | UUID | Пользователь, отредактировавший операцию. |
| created_at | datetime | Метка создания. |
| updated_at | datetime | Метка последнего изменения. |

> Направление движения средств определяется тем, какой endpoint используется: `POST /.../incomes` добавляет поступление, `POST /.../expenses` — расход. Поле `type` в контракте не передаётся.

## Ресурс `/deals/{deal_id}/policies/{policy_id}/payments`

> **Важно.** Все маршруты раздела возвращают `404 policy_not_found`, если указанный полис не принадлежит текущему арендатору, не связан со сделкой `deal_id` или был удалён.

### GET `/deals/{deal_id}/policies/{policy_id}/payments`
Возвращает список платежей полиса.

**Параметры запроса**
| Имя | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| status | array[string] | Нет | Фильтр по статусу (`scheduled`, `partially_paid`, `paid`, `cancelled`), передавайте `status[]=paid`. |
| include | array[string] | Нет | `incomes`, `expenses`. По умолчанию возвращаются только агрегаты; используйте `include[]=incomes`/`include[]=expenses` для вложенных списков. |
| limit | integer | Нет | Количество записей (по умолчанию 50, максимум 200). |
| offset | integer | Нет | Смещение постраничной навигации. |

**Ответ 200**
```json
{
  "items": [
    {
      "id": "7a0b99f3-0d19-48db-b229-feb62ad633c7",
      "deal_id": "a6b3f3aa-2cb1-4a7d-8b23-45fe1cc0c4c0",
      "policy_id": "1d5c92c6-2ac6-4b1b-8f02-233ed4d744e0",
      "sequence": 1,
      "status": "partially_paid",
      "planned_date": "2024-03-01",
      "actual_date": null,
      "planned_amount": "150000.00",
      "currency": "RUB",
      "comment": "Авансовый платёж по договору",
      "incomes_total": "80000.00",
      "expenses_total": "0.00",
      "net_total": "80000.00",
      "created_at": "2024-02-20T11:42:31Z",
      "updated_at": "2024-03-12T08:15:03Z",
      "created_by_id": "bd6e3c84-7a2c-4c7f-9be3-3f4f38f6d323",
      "updated_by_id": "bd6e3c84-7a2c-4c7f-9be3-3f4f38f6d323",
      "recorded_by_id": null,
      "incomes": [
        {
          "id": "a4ea740a-9607-4d12-88cf-ec0e823a531d",
          "payment_id": "7a0b99f3-0d19-48db-b229-feb62ad633c7",
          "amount": "80000.00",
          "currency": "RUB",
          "category": "wire",
          "posted_at": "2024-03-11",
          "note": "Поступление от клиента",
          "created_by_id": "bd6e3c84-7a2c-4c7f-9be3-3f4f38f6d323",
          "updated_by_id": null,
          "created_at": "2024-03-11T09:12:00Z",
          "updated_at": "2024-03-11T09:12:00Z"
        }
      ],
      "expenses": []
    }
  ],
  "total": 1
}
```

**Ошибки**: `401 invalid_token`, `403 forbidden`, `404 policy_not_found` (полис недоступен в рамках указанного `tenant_id` или сделки).

### POST `/deals/{deal_id}/policies/{policy_id}/payments`
Создаёт новую запись платежа.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| planned_date | date | Нет | Плановая дата платежа. |
| planned_amount | string (decimal) | Да | Плановая сумма платежа. |
| currency | string | Да | Код валюты. |
| comment | string | Нет | Комментарий до 500 символов. |

**Ответ 201** — объект платежа (см. выше). После создания CRM публикует событие `deal.payment.created` в exchange `crm.events`.

**Ошибки**: `400 validation_error`, `401 invalid_token`, `403 forbidden`, `404 policy_not_found` (полис недоступен в рамках указанного `tenant_id` или сделки).

### GET `/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}`
Возвращает платёж вместе с агрегированными данными и, опционально, операциями.

**Параметры запроса**: `include[]=incomes`, `include[]=expenses`.

**Ответ 200** — объект платежа.

### PATCH `/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}`
Обновляет плановые значения, комментарий и дату закрытия платежа. Если указано `actual_date`, CRM сохранит дату и обновит `updated_by_id` текущего пользователя. Для ручного подтверждения факта оплаты можно передать идентификатор пользователя в `recorded_by_id`.

**Тело запроса** (все поля опциональные)
| Поле | Тип | Описание |
| --- | --- | --- |
| planned_date | date | Новая плановая дата. |
| planned_amount | string (decimal) | Новая сумма. |
| currency | string | Код валюты (пересчитывать существующие операции запрещено, только если ещё нет поступлений/расходов). |
| comment | string | Комментарий. |
| actual_date | date | Дата закрытия платежа. Должна быть не раньше `planned_date` (если задана) и не позже текущего дня. |
| status | string | Принудительная установка статуса (`cancelled`). Доступна пользователям с ролью `admin` («главный админ»). |
| recorded_by_id | UUID | Пользователь, который вручную подтвердил платёж; передавайте вместе с `actual_date`, если закрытие фиксирует конкретный сотрудник. |

**Ответ 200** — обновлённый объект платежа.

**Ошибки**: `400 validation_error`, `400 actual_date_before_planned_date`, `400 actual_date_in_future`, `401 invalid_token`, `403 forbidden` (попытка установить статус без прав главного админа), `404 payment_not_found`, `409 payment_has_transactions` (для изменений, требующих пустого списка операций).

### DELETE `/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}`
Удаляет платёж и связанные операции. Доступно только, если у записи ещё нет поступлений и расходов.

**Ответ 204** — без тела. Удаление возможно только для платежей без операций; при наличии поступлений или расходов API вернёт `409 payment_has_transactions`.

**Ошибки**: `400 validation_error`, `401 invalid_token`, `403 forbidden`, `404 payment_not_found`, `409 payment_has_transactions`.

## Поступления (`/incomes`)

### POST `/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/incomes`
Добавляет поступление средств; направление операции задаётся самим маршрутом `/incomes`.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| amount | string (decimal) | Да | Сумма поступления. |
| currency | string | Да | Код валюты (должен совпадать с валютой платежа). |
| category | string | Да | Категория (`wire`, `cash`, `bonus`, ...). |
| posted_at | date | Да | Дата поступления. |
| note | string | Нет | Комментарий (до 300 символов). |

**Ответ 201** — объект операции поступления.

**Ошибки**: `400 validation_error`, `400 currency_mismatch`, `400 posted_at_in_future`, `401 invalid_token`, `403 forbidden`, `404 payment_not_found`.

### PATCH `/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/incomes/{income_id}`
Изменяет сумму, категорию, дату и комментарий поступления.

**Тело запроса** (все поля опциональные): `amount`, `category`, `posted_at`, `note`.

**Ответ 200** — обновлённый объект операции.

**Ошибки**: `400 validation_error`, `400 currency_mismatch`, `400 posted_at_in_future`, `401 invalid_token`, `403 forbidden`, `404 income_not_found`.

### DELETE `/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/incomes/{income_id}`
Удаляет операцию поступления.

**Ответ 204** — без тела.

**Ошибки**: `401 invalid_token`, `403 forbidden`, `404 income_not_found`.

## Расходы (`/expenses`)

Интерфейсы аналогичны `/incomes`, но отражают комиссии, возвраты и другие удержания; направление операции задаётся самим маршрутом `/expenses`.

### POST `/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/expenses`
Создаёт запись расхода.

**Тело запроса** — то же, что и для `/incomes`.

**Ответ 201** — объект расхода.

**Ошибки**: `400 validation_error`, `400 currency_mismatch`, `400 posted_at_in_future`, `401 invalid_token`, `403 forbidden`, `404 payment_not_found`.

### PATCH `/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/expenses/{expense_id}`
Обновляет параметры расхода (`amount`, `category`, `posted_at`, `note`).

**Ответ 200** — обновлённый объект расхода.

**Ошибки**: `400 validation_error`, `400 currency_mismatch`, `400 posted_at_in_future`, `401 invalid_token`, `403 forbidden`, `404 expense_not_found`.

### DELETE `/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/expenses/{expense_id}`
Удаляет расход.

**Ответ 204** — без тела.

## Журналирование и события
- Все операции записываются в аудит CRM с фиксацией пользователя, предыдущего и нового значения.
- При изменениях публикуются события `deal.payment.created`, `deal.payment.updated`, `deal.payment.deleted`, `deal.payment.income.*`, `deal.payment.expense.*` в очереди `crm.events`.
- Фронтенд обновляет карточку полиса по REST-запросам и потокам SSE (`/streams/deals`).
