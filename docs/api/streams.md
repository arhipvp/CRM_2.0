# SSE-каналы

Gateway публикует события через Server-Sent Events (SSE) для клиентов веб-интерфейса. Подключение выполняется по заголовкам `Accept: text/event-stream` и `Authorization: Bearer <JWT>`.

## Общие правила
- Соединение поддерживается на уровне Gateway: `GET /api/v1/streams/{channel}`.
- Каждый канал использует `Last-Event-ID` для восстановления после обрыва.
- Все payload передаются в формате JSON, поле `event` — тип события, `data` — сериализованный объект.
- При изменении схемы события повышается версия канала (`?version=2`).

## Канал `deals`
- **Маршрут:** `GET /api/v1/streams/deals`
- **Назначение:** оперативные изменения сделок, клиентов, расчётов и полисов.
- **Источник данных:** CRM/Deals публикует доменные события в RabbitMQ (`crm.domain`), Gateway транслирует их в SSE.

| Тип события | Описание | Payload |
| --- | --- | --- |
| `deal.created` | Создана новая сделка. | `{ "deal_id": "uuid", "client_id": "uuid", "title": "string", "status": "draft", "created_at": "datetime" }` |
| `deal.updated` | Изменились реквизиты сделки. | `{ "deal_id": "uuid", "changes": { "status": "issuing" }, "updated_at": "datetime", "version": 5 }` |
| `deal.journal.appended` | Добавлена запись в журнал. | `{ "deal_id": "uuid", "entry_id": "uuid", "author_id": "uuid", "text": "string", "created_at": "datetime" }` |
| `policy.status.changed` | Полис сменил статус. | `{ "policy_id": "uuid", "deal_id": "uuid", "status": "active", "effective_from": "date", "effective_to": "date" }` |
| `calculation.added` | Добавлен расчёт. | `{ "calculation_id": "uuid", "deal_id": "uuid", "insurance_company": "string", "premium_amount": 12345.67 }` |

**Ошибки канала:**
- `event: error` + `data: {"code": "forbidden"}` — пользователь не имеет доступа, соединение закрывается.
- `event: heartbeat` каждые 30 секунд для проверки соединения (payload пустой).

## Канал `tasks`
- **Маршрут:** `GET /api/v1/streams/tasks`
- **Назначение:** обновления задач и напоминаний.
- **Источник данных:** Tasks API публикует события в RabbitMQ (`tasks.events`).

| Тип события | Описание | Payload |
| --- | --- | --- |
| `task.created` | Создана новая задача. | `{ "task_id": "uuid", "subject": "string", "assignee_id": "uuid", "due_date": "date", "status": "open" }` |
| `task.updated` | Изменения по задаче. | `{ "task_id": "uuid", "changes": { "status": "in_progress" }, "updated_at": "datetime" }` |
| `task.reminder` | Напоминание по задаче. | `{ "task_id": "uuid", "remind_at": "datetime", "channel": "sse" }` |

## Канал `notifications`
- **Маршрут:** `GET /api/v1/streams/notifications`
- **Назначение:** доставка внутренних уведомлений (без участия Telegram).
- **Источник данных:** Notifications API — очередь `notifications.internal`.

| Тип события | Описание | Payload |
| --- | --- | --- |
| `notification.sent` | Уведомление отправлено пользователю. | `{ "notification_id": "uuid", "template": "deal.status.changed", "title": "string", "body": "string", "created_at": "datetime" }` |
| `notification.read` | Пользователь подтвердил чтение. | `{ "notification_id": "uuid", "read_at": "datetime" }` |

## Канал `payments`
- **Маршрут:** `GET /api/v1/streams/payments`
- **Назначение:** обновления по платежам для финансовых менеджеров.
- **Источник данных:** Payments API события `payments.status`.

| Тип события | Описание | Payload |
| --- | --- | --- |
| `payment.status.changed` | Изменился статус платежа. | `{ "payment_id": "uuid", "deal_id": "uuid", "status": "received", "actual_date": "date", "amount": 12345.67, "currency": "RUB" }` |
| `payment.overdue` | Платёж просрочен. | `{ "payment_id": "uuid", "deal_id": "uuid", "due_date": "date", "amount": 12345.67 }` |

## Управление соединением
- Gateway поддерживает до 5 одновременных каналов на пользователя; при превышении старые соединения закрываются.
- Клиент должен обрабатывать `HTTP 409` с телом `{ "code": "stream_limit" }` при попытке открыть дополнительное соединение.
- При недоступности источника Gateway отправляет `event: warning` и `data: {"code": "source_unavailable", "channel": "deals"}` каждые 60 секунд до восстановления.
