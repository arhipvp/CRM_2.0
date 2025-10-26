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
| `deal.journal.appended` | `crm.deal.journal.appended` | `{ "deal_id": "uuid", "entry_id": "uuid", "author_id": "uuid", "body": "string", "created_at": "datetime" }` | Журнал идемпотентен по `entry_id`; потребители проверяют `event_id` для защиты от повторов. |
| `deal.calculation.created`<br>`deal.calculation.updated` | `crm.deal.calculation.created`<br>`crm.deal.calculation.updated` | `{ "calculation_id": "uuid", "deal_id": "uuid", "status": "draft", "insurance_company": "string", "calculation_date": "date", "premium_amount": "12345.67", "policy_id": "uuid"\|null }` | Идемпотентность по `calculation_id` + `event_id`; потребители синхронизируют атрибуты по последнему событию. |
| `deal.calculation.deleted` | `crm.deal.calculation.deleted` | `{ "calculation_id": "uuid", "deal_id": "uuid", "status": "ready", "insurance_company": "string", "calculation_date": "date" }` | Потребители удаляют запись и фиксируют `event_id`. |
| `deal.calculation.status.ready`<br>`deal.calculation.status.confirmed`<br>`deal.calculation.status.archived` | `crm.deal.calculation.status.ready`<br>`crm.deal.calculation.status.confirmed`<br>`crm.deal.calculation.status.archived` | `{ "calculation_id": "uuid", "deal_id": "uuid", "status": "confirmed", "insurance_company": "string", "calculation_date": "date", "policy_id": "uuid"\|null }` | Проверять переходы по `calculation_id`; повторные события с тем же `event_id` игнорируются. |
| `deal.payment.created`<br>`deal.payment.updated` | `crm.deal.payment.created`<br>`crm.deal.payment.updated` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment": { "payment_id": "uuid", "sequence": 1, "status": "scheduled"\|"posted", "planned_date": "date", "actual_date": "date"\|null, "incomes_total": "decimal", "expenses_total": "decimal", "net_total": "decimal", "incomes": [...], "expenses": [...] } }` | Идемпотентность по `payment_id` + `event_id`; потребители пересобирают агрегат и вложенные доходы/расходы. |
| `deal.payment.deleted` | `crm.deal.payment.deleted` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "deleted_at": "datetime" }` | Запись помечается удалённой по `payment_id`; повтор определяется по `event_id`. |
| `deal.payment.income.created`<br>`deal.payment.income.updated`<br>`deal.payment.income.deleted` | `crm.deal.payment.income.created`<br>`crm.deal.payment.income.updated`<br>`crm.deal.payment.income.deleted` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "income": { "income_id": "uuid", "amount": "decimal", "posted_at": "date", "note": "string"\|null, "deleted_at": "datetime"\|null }, "previous": { ... }\|null }` | Идемпотентность по `income_id` + `event_id`; при `deleted_at` потребители помечают операцию удалённой. |
| `deal.payment.expense.created`<br>`deal.payment.expense.updated`<br>`deal.payment.expense.deleted` | `crm.deal.payment.expense.created`<br>`crm.deal.payment.expense.updated`<br>`crm.deal.payment.expense.deleted` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "expense": { "expense_id": "uuid", "amount": "decimal", "posted_at": "date", "note": "string"\|null, "deleted_at": "datetime"\|null }, "previous": { ... }\|null }` | Идемпотентность по `expense_id` + `event_id`; потребители синхронизируют расходы и агрегаты платежа. |

> Обобщённое событие `deal.updated` больше не публикуется: любые изменения сделки фиксируются через `deal.journal.appended`, семейство `deal.calculation.*` и события `deal.payment.*`.

> Payload событий `deal.payment.*` повторяет структуру объектов платёжного API модуля CRM/Deals; см. [docs/api/payments.md](api/payments.md) для полного описания REST-контрактов.

> Routing key `deal.payment.income.*` и `deal.payment.expense.*` отражают операции по доходам и расходам одного платежа. Приёмники должны хранить пары (`income_id`, `event_id`) и (`expense_id`, `event_id`) в собственных журналах идемпотентности и синхронизировать агрегаты с учётом вложенных массивов в событии `deal.payment.updated`.

> События создания, обновления статуса и напоминаний по задачам публикуются модулем CRM Tasks через exchange `tasks.events`; см. раздел [«События Tasks»](#события-tasks).

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
- **Exchange:** `notifications.events`
- **Тип обмена:** topic
- **Очереди-потребители:** `gateway.notifications`

| Routing key | CloudEvent `type` | `data` | Идемпотентность |
| --- | --- | --- | --- |
| `notification.dispatched` | `notifications.notification.dispatched` | `{ "notification_id": "uuid", "user_id": "uuid", "channels": ["telegram"], "template": "deal.status.changed", "created_at": "datetime" }` | Gateway ведёт таблицу доставленных уведомлений (idempotent key = `notification_id`). |
| `notification.failed` | `notifications.notification.failed` | `{ "notification_id": "uuid", "user_id": "uuid", "channel": "telegram", "reason": "blocked" }` | Notifications сохраняет `notification_id` + `event_id` в собственной БД. |
| `notification.read` | `notifications.notification.read` | `{ "notification_id": "uuid", "user_id": "uuid", "read_at": "datetime" }` | Gateway обновляет состояние и проверяет `event_id`. |

## События Documents
- **Exchange:** `documents.events`
- **Тип обмена:** topic
- **Очереди-потребители:** `crm.documents`, `notifications.documents`

| Routing key | CloudEvent `type` | `data` | Идемпотентность |
| --- | --- | --- | --- |
| `document.uploaded` | `documents.document.uploaded` | `{ "document_id": "uuid", "owner_type": "deal", "owner_id": "uuid", "title": "string", "uploaded_by": "uuid", "uploaded_at": "datetime" }` | CRM проверяет `document_id`, сохраняет `event_id`. |
| `document.deleted` | `documents.document.deleted` | `{ "document_id": "uuid", "deleted_at": "datetime", "deleted_by": "uuid" }` | Потребители хранят `document_id` + `event_id`. |

## Требования к обработчикам
- Приёмники обязаны обрабатывать повторную доставку (`at-least-once`), опираясь на `id` события.
- Все события подписываются заголовком `X-Trace-Id`, который должен логироваться для трассировки сквозных операций.
- Несовместимые изменения формата `data` оформляются как новые routing key (`*.v2`).
