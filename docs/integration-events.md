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
| `deal.created` | `crm.deal.created` | `{ "deal_id": "uuid", "client_id": "uuid", "title": "string", "status": "draft", "created_at": "datetime", "sales_agent_id": "uuid" }` | Потребители хранят `event_id` в таблице связей; повторное событие игнорируется. |
| `deal.status.changed` | `crm.deal.status_changed` | `{ "deal_id": "uuid", "old_status": "draft", "new_status": "issuing", "changed_at": "datetime", "actor_id": "uuid" }` | CRM повторно не публикует одинаковые переходы; потребители проверяют пару (`deal_id`, `event_id`). |
| `policy.issued` | `crm.policy.issued` | `{ "policy_id": "uuid", "deal_id": "uuid", "effective_from": "date", "effective_to": "date", "premium_amount": 12345.67 }` | Tasks/Notifications сохраняют `policy_id` + `event_id`. |
| `task.requested` | `crm.task.requested` | `{ "task_id": "uuid", "deal_id": "uuid", "subject": "string", "assignee_id": "uuid", "due_date": "date" }` | CRM Tasks сверяет `task_id` и создаёт/обновляет запись, сохраняя `event_id`. |
| `deal.payment.created` | `crm.deal.payment.created` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "sequence": 1, "planned_amount": "12345.67", "status": "scheduled", "planned_date": "date" }` | Потребители фиксируют `payment_id` + `event_id`. |
| `deal.payment.deleted` | `crm.deal.payment.deleted` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "deleted_at": "datetime" }` | Потребители помечают запись удалённой и сохраняют `event_id`. |
| `deal.payment.income.created` | `crm.deal.payment.income.created` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "income": { "income_id": "uuid", "category": "client_payment", "amount": "1234.56", "posted_at": "date", "note": "string", "created_by_id": "uuid", "updated_by_id": null } }` | Идемпотентность по `income_id` в сочетании с `event_id`. |
| `deal.payment.income.updated` | `crm.deal.payment.income.updated` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "income": { "income_id": "uuid", "category": "client_payment", "amount": "1234.56", "posted_at": "date", "note": "string", "created_by_id": "uuid", "updated_by_id": "uuid" }, "previous": { "amount": "1200.00", "category": "client_payment", "posted_at": "date", "note": null } }` | Потребители фиксируют `income_id` и проверяют версию по `event_id`. |
| `deal.payment.income.deleted` | `crm.deal.payment.income.deleted` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "income": { "income_id": "uuid", "deleted_at": "datetime", "deleted_by_id": "uuid" } }` | Удаление обрабатывается по `income_id`; повторные события игнорируются. |
| `deal.payment.expense.created` | `crm.deal.payment.expense.created` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "expense": { "expense_id": "uuid", "category": "agent_fee", "amount": "654.33", "posted_at": "date", "note": "string", "created_by_id": "uuid", "updated_by_id": null } }` | Идемпотентность по `expense_id` и `event_id`. |
| `deal.payment.expense.updated` | `crm.deal.payment.expense.updated` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "expense": { "expense_id": "uuid", "category": "agent_fee", "amount": "654.33", "posted_at": "date", "note": "string", "created_by_id": "uuid", "updated_by_id": "uuid" }, "previous": { "amount": "600.00", "category": "agent_fee", "posted_at": "date", "note": null } }` | Потребители фиксируют `expense_id` и `event_id`, обновляя запись только при новой версии. |
| `deal.payment.expense.deleted` | `crm.deal.payment.expense.deleted` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "expense": { "expense_id": "uuid", "deleted_at": "datetime", "deleted_by_id": "uuid" } }` | Повторы распознаются по `expense_id` + `event_id`. |
| `deal.payment.updated` | `crm.deal.payment.updated` | `{ "deal_id": "uuid", "policy_id": "uuid", "payment": { "payment_id": "uuid", "sequence": 1, "status": "posted", "actual_date": "date", "incomes_total": "13000.00", "expenses_total": "654.33", "net_total": "12345.67", "updated_at": "datetime", "updated_by_id": "uuid", "incomes": [{ "income_id": "uuid", "category": "client_payment", "amount": "13000.00", "posted_at": "date", "note": "string", "created_by_id": "uuid", "updated_by_id": "uuid" }], "expenses": [{ "expense_id": "uuid", "category": "agent_fee", "amount": "654.33", "posted_at": "date", "note": "string", "created_by_id": "uuid", "updated_by_id": "uuid" }] } }` | Потребители сверяют агрегат по `payment_id` и сохраняют `event_id`; при расхождениях переписывают вложенные записи по идентификаторам `income_id`/`expense_id`. |

> Payload событий `deal.payment.*` повторяет структуру объектов платёжного API модуля CRM/Deals; см. [docs/api/payments.md](api/payments.md) для полного описания REST-контрактов.

> Routing key `deal.payment.income.*` и `deal.payment.expense.*` отражают операции по доходам и расходам одного платежа. Приёмники должны хранить пары (`income_id`, `event_id`) и (`expense_id`, `event_id`) в собственных журналах идемпотентности и синхронизировать агрегаты с учётом вложенных массивов в событии `deal.payment.updated`.

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
