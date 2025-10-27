# Интеграционные события (RabbitMQ)

Документ фиксирует форматы сообщений, которые сервисы CRM публикуют и потребляют через RabbitMQ. Все события передаются в JSON и оформлены по принципам CloudEvents (`id`, `source`, `type`, `time`, `data`). Для обеспечения идемпотентности обязательны:
- уникальный `id` события (UUID);
- заголовок `ce-specversion: 1.0`;
- сохранение `id` обработанных событий в таблицах приёмников для защиты от повторной доставки.

## События CRM / Deals
- **Exchange:** `crm.events` (значение задаётся переменной окружения `CRM_EVENTS_EXCHANGE`)
- **Тип обмена:** topic
- **Очереди-потребители:** `tasks.crm`, `notifications.crm`

| Routing key | CloudEvent `type` | `data` | Идемпотентность |
| --- | --- | --- | --- |
| `deal.journal.appended` | `crm.deal.journal.appended` | `{ "deal_id": "uuid", "entry_id": "uuid", "author_id": "uuid", "body": "string", "created_at": "datetime" }` | Потребители проверяют `entry_id`; повторная доставка обновляет отметку времени. |
| `deal.calculation.created` | `crm.deal.calculation.created` | `{ "deal_id": "uuid", "calculation_id": "uuid", "status": "draft", "insurance_company": "string", "calculation_date": "date", "program_name": "string\|null", "premium_amount": "12345.67\|null", "policy_id": "uuid\|null" }` | Журналируйте `calculation_id`; событие создаёт запись в витринах расчётов. |
| `deal.calculation.updated` | `crm.deal.calculation.updated` | `{ "deal_id": "uuid", "calculation_id": "uuid", "status": "draft", "insurance_company": "string", "calculation_date": "date", "program_name": "string\|null", "premium_amount": "12345.67\|null", "policy_id": "uuid\|null" }` | Обновления применяются по `calculation_id`; сохраните последний `event_id`. |
| `deal.calculation.deleted` | `crm.deal.calculation.deleted` | `{ "deal_id": "uuid", "calculation_id": "uuid", "status": "draft", "insurance_company": "string", "calculation_date": "date", "program_name": "string\|null", "premium_amount": "12345.67\|null", "policy_id": "uuid\|null" }` | Повторы игнорируйте по `calculation_id`; удаляйте локальные копии. |
| `deal.calculation.status.ready`<br>`deal.calculation.status.confirmed`<br>`deal.calculation.status.archived` | `crm.deal.calculation.status.ready`<br>`crm.deal.calculation.status.confirmed`<br>`crm.deal.calculation.status.archived` | `{ "deal_id": "uuid", "calculation_id": "uuid", "status": "ready\|confirmed\|archived", "insurance_company": "string", "calculation_date": "date", "program_name": "string\|null", "premium_amount": "12345.67\|null", "policy_id": "uuid\|null" }` | Переходы фиксируются по `calculation_id` + `status`; повторная доставка не меняет состояние. |
| `deal.payment.created` | `crm.deal.payment.created` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment": { "id": "uuid", "deal_id": "uuid", "policy_id": "uuid", "sequence": 1, "status": "scheduled", "planned_date": "date\|null", "planned_amount": "12345.67", "currency": "RUB", "comment": "string\|null", "actual_date": "date\|null", "recorded_by_id": "uuid\|null", "created_by_id": "uuid\|null", "updated_by_id": "uuid\|null", "incomes_total": "0.00", "expenses_total": "0.00", "net_total": "0.00", "created_at": "datetime", "updated_at": "datetime", "incomes": [], "expenses": [] } }` | Потребители используют `payment.id` в качестве идемпотентного ключа. |
| `deal.payment.updated` | `crm.deal.payment.updated` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment": { ... } }`, где `payment` соответствует сериализации `PaymentRead` (см. ниже) со статусом `scheduled\|partially_paid\|paid\|cancelled`. | Храните `payment.id` + `event_id`; повтор события перезаписывает агрегаты и вложенные движения. |
| `deal.payment.deleted` | `crm.deal.payment.deleted` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "deleted_at": "datetime" }` | Потребители помечают запись удалённой по `payment_id`. |
| `deal.payment.income.created` | `crm.deal.payment.income.created` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "income": { "income_id": "uuid", "payment_id": "uuid", "amount": "1234.56", "currency": "RUB", "category": "client_payment", "posted_at": "date", "note": "string\|null", "created_by_id": "uuid\|null", "updated_by_id": "uuid\|null", "created_at": "datetime", "updated_at": "datetime" } }` | Идемпотентность по `income.income_id` + `event_id`. |
| `deal.payment.income.updated` | `crm.deal.payment.income.updated` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "income": { ... }, "previous": { "payment_id": "uuid", "amount": "1200.00", "currency": "RUB", "category": "client_payment", "posted_at": "date", "note": "string\|null", "created_by_id": "uuid\|null", "updated_by_id": "uuid\|null", "created_at": "datetime", "updated_at": "datetime" } }` | Обновления применяются по `income.income_id`; сохраните `event_id` для версионирования. |
| `deal.payment.income.deleted` | `crm.deal.payment.income.deleted` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "income": { "income_id": "uuid", "deleted_at": "datetime", "deleted_by_id": "uuid\|null" } }` | Повторы определяются по `income.income_id`. |
| `deal.payment.expense.created` | `crm.deal.payment.expense.created` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "expense": { "expense_id": "uuid", "payment_id": "uuid", "amount": "654.33", "currency": "RUB", "category": "agent_fee", "posted_at": "date", "note": "string\|null", "created_by_id": "uuid\|null", "updated_by_id": "uuid\|null", "created_at": "datetime", "updated_at": "datetime" } }` | Идемпотентность по `expense.expense_id` + `event_id`. |
| `deal.payment.expense.updated` | `crm.deal.payment.expense.updated` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "expense": { ... }, "previous": { "payment_id": "uuid", "amount": "600.00", "currency": "RUB", "category": "agent_fee", "posted_at": "date", "note": "string\|null", "created_by_id": "uuid\|null", "updated_by_id": "uuid\|null", "created_at": "datetime", "updated_at": "datetime" } }` | Обновления применяются по `expense.expense_id`; сохраните `event_id` для контроля версий. |
| `deal.payment.expense.deleted` | `crm.deal.payment.expense.deleted` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "expense": { "expense_id": "uuid", "deleted_at": "datetime", "deleted_by_id": "uuid\|null" } }` | Повторы определяются по `expense.expense_id`. |

> Payload событий `deal.payment.*` повторяет структуру объектов платёжного API модуля CRM/Deals; см. [docs/api/payments.md](api/payments.md) для полного описания REST-контрактов и сериализацию `PaymentRead`.

> Routing key `deal.payment.income.*` и `deal.payment.expense.*` отражают операции по доходам и расходам одного платежа. Приёмники должны хранить пары (`income_id`, `event_id`) и (`expense_id`, `event_id`) в собственных журналах идемпотентности и синхронизировать агрегаты с учётом вложенных массивов в событии `deal.payment.updated`.

> События создания, обновления статуса и напоминаний по задачам публикуются модулем CRM Tasks через exchange `tasks.events`; см. раздел [«События Tasks»](#события-tasks). Модуль уведомлений публикует задачи на доставку в exchange `notifications.exchange` (см. раздел [«События Notifications»](#события-notifications)).

## События Tasks
- **Exchange:** `tasks.events` (управляется переменной `CRM_TASKS_EVENTS_EXCHANGE`)
- **Тип обмена:** topic
- **Очереди-потребители:** `notifications.tasks`
- **Source:** `crm.tasks` (значение задаётся `CRM_TASKS_EVENTS_SOURCE`)

| Routing key | CloudEvent `type` | `data` | Идемпотентность |
| --- | --- | --- | --- |
| `task.created` | `tasks.task.created` | `{ "task_id": "uuid", "subject": "string", "assignee_id": "uuid\|null", "author_id": "uuid\|null", "status": "pending\|scheduled\|in_progress\|completed\|cancelled", "due_date": "datetime\|null", "scheduled_for": "datetime\|null", "context": { "deal_id": "uuid", "client_id": "uuid", "policy_id": "uuid" } }` | Событие публикует встроенный модуль CRM Tasks; Notifications хранит `event_id` и журналирует дополнительные поля для аналитики. |
| `task.status.changed` | `tasks.task.status_changed` | `{ "task_id": "uuid", "old_status": "pending\|scheduled\|in_progress\|completed\|cancelled", "new_status": "pending\|scheduled\|in_progress\|completed\|cancelled", "changed_at": "datetime" }` | Изменения публикует CRM Tasks; потребители определяют повторы по `event_id`. Доступные значения `old_status`/`new_status`: `pending` (Назначена), `scheduled` (Запланирована), `in_progress` (В работе), `completed` (Выполнена), `cancelled` (Отменена). |
| `task.reminder` | `tasks.task.reminder` | `{ "task_id": "uuid", "remind_at": "datetime", "channel": "sse" }` | Напоминание публикует CRM Tasks; Notifications хранит `event_id` и дополнительно учитывает комбинацию (`task_id`, `remind_at`) при построении витрин. |

> Статусы задач в событиях `task.created` и `task.status.changed` соответствуют кодам `TaskStatusCode` из CRM и передаются без локализации: `pending`, `scheduled`, `in_progress`, `completed`, `cancelled`.

> Обработка напоминаний выполняется сервисом `TaskReminderProcessor`: он опрашивает Redis-очередь `CRM_TASKS_REMINDERS_QUEUE_KEY` каждые `CRM_TASKS_REMINDERS_POLL_INTERVAL_MS` миллисекунд, публикуя событие и удаляя элемент из очереди; при ошибке напоминание переотправляется с задержкой.

> Поле `channel` соответствует каналу доставки напоминания и принимает значения `sse` (значение по умолчанию) или `telegram` — в зависимости от параметра, который был передан при создании напоминания через Tasks API.

> Поля `assignee_id`, `author_id`, `due_date`, `scheduled_for` и ключи объекта `context` могут принимать значение `null`, если соответствующие данные не заданы в задаче.

## События Notifications
- **Exchange:** `notifications.exchange`
- **Тип обмена:** topic
- **Основной routing key:** `notifications.dispatch`
- **Очереди-потребители:** подключаются на стороне коннекторов доставки (в CRM нет жёстко заданного имени очереди)

| Канал | Формат сообщения | Особенности идемпотентности |
| --- | --- | --- |
| RabbitMQ (`exchange` = `notifications.exchange`, `routing key` = `notifications.dispatch`) | `{ "notificationId": "uuid", "eventKey": "string", "payload": { ... }, "recipients": [{ "userId": "string", "telegramId": "string\|null" }], "channelOverrides": ["string", ...], "deduplicationKey": "string\|null" }` | Потребители обязаны учитывать `notificationId` как уникальный идентификатор задачи на доставку. |
| Redis pub/sub (`channel` = `notifications:dispatch`) | Сообщение идентично публикации в RabbitMQ (JSON-строка). | Используется для внутренних воркеров; повторная доставка контролируется получателями по `notificationId`. |
| Внутренний stream (SSE через `NotificationStreamService`) | `{ "event": "<event_type>", "data": { "eventType": "<event_type>", "payload": { ... } }, "retry": <milliseconds> }`. При исходном событии `<event_type>` = значению `eventKey`, дополнительно публикуются события `notifications.telegram.sent\|skipped\|error` и `notifications.telegram.delivery`. | Подписчики stream-а используют `payload.notificationId` для фильтрации и дедупликации. |

> Публикации CloudEvent `notifications.notification.*` ещё не реализованы в CRM; они остаются в плане развития после стабилизации текущего контура доставки.

### Payload `notifications.dispatch`

Payload формируется методом `NotificationService.enqueue` и повторяет модель `NotificationCreate`:

```json
{
  "notificationId": "4a0df3c0-3c6a-4c2d-8d83-5a458b6b2799",
  "eventKey": "deal.status.changed",
  "payload": { "dealId": "...", "oldStatus": "pending", "newStatus": "won" },
  "recipients": [
    {
      "userId": "manager-42",
      "telegramId": "123456789"
    }
  ],
  "channelOverrides": ["telegram"],
  "deduplicationKey": "deal-123-status-won"
}
```

- `eventKey` — ключ сценария уведомления.
- `payload` — произвольный словарь данных сценария (например, параметры сделки или задачи).
- `recipients` — массив получателей; поля соответствуют `NotificationRecipient`. Значение `telegramId` может быть `null`, если чат ещё не привязан.
- `channelOverrides` — необязательный список каналов доставки, если нужно переопределить поведение шаблона (при отсутствии передаётся пустой список).
- `deduplicationKey` — опциональный ключ для защиты от повторной постановки одной и той же задачи; может быть `null`.

> Все каналы доставки получают одно и то же сообщение, поэтому потребители должны быть готовы к повторной доставке и сохранять `notificationId` / `deduplicationKey` в своих журналах.

## Требования к обработчикам
- Приёмники обязаны обрабатывать повторную доставку (`at-least-once`), опираясь на `id` события.
- Все события подписываются заголовком `X-Trace-Id`, который должен логироваться для трассировки сквозных операций.
- Несовместимые изменения формата `data` оформляются как новые routing key (`*.v2`).

## Планы
- События модуля документов находятся в разработке и пока не реализованы. Финальные схемы обмена и routing key будут опубликованы после завершения проектирования.
