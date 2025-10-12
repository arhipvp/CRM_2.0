# Интеграционные события (RabbitMQ)

Документ фиксирует форматы сообщений, которые сервисы CRM публикуют и потребляют через RabbitMQ. Все события передаются в JSON и оформлены по принципам CloudEvents (`id`, `source`, `type`, `time`, `data`). Для обеспечения идемпотентности обязательны:
- уникальный `id` события (UUID);
- заголовок `ce-specversion: 1.0`;
- сохранение `id` обработанных событий в таблицах приёмников для защиты от повторной доставки.

## События CRM / Deals
- **Exchange:** `crm.domain`
- **Тип обмена:** topic
- **Очереди-потребители:** `tasks.crm`, `notifications.crm`, `audit.crm`

| Routing key | CloudEvent `type` | `data` | Идемпотентность |
| --- | --- | --- | --- |
| `deal.created` | `crm.deal.created` | `{ "deal_id": "uuid", "client_id": "uuid", "title": "string", "status": "draft", "created_at": "datetime", "sales_agent_id": "uuid" }` | Потребители хранят `event_id` в таблице связей; повторное событие игнорируется. |
| `deal.status.changed` | `crm.deal.status_changed` | `{ "deal_id": "uuid", "old_status": "draft", "new_status": "issuing", "changed_at": "datetime", "actor_id": "uuid" }` | CRM повторно не публикует одинаковые переходы; потребители проверяют пару (`deal_id`, `event_id`). |
| `policy.issued` | `crm.policy.issued` | `{ "policy_id": "uuid", "deal_id": "uuid", "effective_from": "date", "effective_to": "date", "premium_amount": 12345.67 }` | Tasks/Notifications сохраняют `policy_id` + `event_id`. |
| `task.requested` | `crm.task.requested` | `{ "task_id": "uuid", "deal_id": "uuid", "subject": "string", "assignee_id": "uuid", "due_date": "date" }` | Tasks сверяет `task_id` и создаёт/обновляет запись, сохраняя `event_id`. |

## События Payments
- **Exchange:** `payments.events`
- **Тип обмена:** topic
- **Очереди-потребители:** `crm.payments`, `tasks.payments`, `notifications.payments`, `audit.payments`

| Routing key | CloudEvent `type` | `data` | Идемпотентность |
| --- | --- | --- | --- |
| `payment.created` | `payments.payment.created` | `{ "payment_id": "uuid", "deal_id": "uuid", "policy_id": "uuid", "amount": 12345.67, "currency": "RUB", "planned_date": "date", "payment_type": "client_premium" }` | CRM сверяет `payment_id`; при повторе обновляет данные, сохраняя `event_id`. |
| `payment.status.changed` | `payments.payment.status_changed` | `{ "payment_id": "uuid", "status": "received", "actual_date": "date", "confirmed_by": "uuid" }` | Потребители ведут таблицу `payment_id` + `status` + `event_id`; повтор с тем же `event_id` игнорируется. |
| `payment.overdue` | `payments.payment.overdue` | `{ "payment_id": "uuid", "deal_id": "uuid", "due_date": "date", "amount": 12345.67 }` | Notifications использует `deduplication_key = payment_id + due_date`. |

## События Tasks
- **Exchange:** `tasks.events`
- **Тип обмена:** topic
- **Очереди-потребители:** `notifications.tasks`, `audit.tasks`

| Routing key | CloudEvent `type` | `data` | Идемпотентность |
| --- | --- | --- | --- |
| `task.created` | `tasks.task.created` | `{ "task_id": "uuid", "subject": "string", "assignee_id": "uuid", "due_date": "date", "context": { "deal_id": "uuid" } }` | Notifications хранит `task_id` + `event_id`. |
| `task.status.changed` | `tasks.task.status_changed` | `{ "task_id": "uuid", "old_status": "open", "new_status": "in_progress", "changed_at": "datetime" }` | Повторы определяются по `event_id`. |
| `task.reminder` | `tasks.task.reminder` | `{ "task_id": "uuid", "remind_at": "datetime", "channel": "sse" }` | Notifications проверяет комбинацию (`task_id`, `remind_at`). |

> Поле `channel` соответствует каналу доставки напоминания и принимает значения `sse` (значение по умолчанию) или `telegram` — в зависимости от параметра, который был передан при создании напоминания через Tasks API.

## События Notifications
- **Exchange:** `notifications.events`
- **Тип обмена:** topic
- **Очереди-потребители:** `audit.notifications`, `gateway.notifications`

| Routing key | CloudEvent `type` | `data` | Идемпотентность |
| --- | --- | --- | --- |
| `notification.dispatched` | `notifications.notification.dispatched` | `{ "notification_id": "uuid", "user_id": "uuid", "channels": ["telegram"], "template": "deal.status.changed", "created_at": "datetime" }` | Gateway ведёт таблицу доставленных уведомлений (idempotent key = `notification_id`). |
| `notification.failed` | `notifications.notification.failed` | `{ "notification_id": "uuid", "user_id": "uuid", "channel": "telegram", "reason": "blocked" }` | Audit сохраняет `notification_id` + `event_id`. |
| `notification.read` | `notifications.notification.read` | `{ "notification_id": "uuid", "user_id": "uuid", "read_at": "datetime" }` | Gateway обновляет состояние и проверяет `event_id`. |

## События Documents
- **Exchange:** `documents.events`
- **Тип обмена:** topic
- **Очереди-потребители:** `crm.documents`, `notifications.documents`, `audit.documents`

| Routing key | CloudEvent `type` | `data` | Идемпотентность |
| --- | --- | --- | --- |
| `document.uploaded` | `documents.document.uploaded` | `{ "document_id": "uuid", "owner_type": "deal", "owner_id": "uuid", "title": "string", "uploaded_by": "uuid", "uploaded_at": "datetime" }` | CRM проверяет `document_id`, сохраняет `event_id`. |
| `document.deleted` | `documents.document.deleted` | `{ "document_id": "uuid", "deleted_at": "datetime", "deleted_by": "uuid" }` | Потребители хранят `document_id` + `event_id`. |

## Требования к обработчикам
- Приёмники обязаны обрабатывать повторную доставку (`at-least-once`), опираясь на `id` события.
- Все события подписываются заголовком `X-Trace-Id`, который должен логироваться для трассировки сквозных операций.
- Несовместимые изменения формата `data` оформляются как новые routing key (`*.v2`).
