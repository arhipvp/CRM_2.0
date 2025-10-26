# SSE-каналы

Gateway публикует события через Server-Sent Events (SSE) для клиентов веб-интерфейса. Подключение выполняется по заголовкам `Accept: text/event-stream` и (при необходимости) `Authorization: Bearer <JWT>`.

## Общие правила
- Соединение поддерживается на уровне Gateway: `GET /api/v1/streams/{channel}`.
- Gateway передаёт upstream-заголовок `Last-Event-ID` и сохраняет полученные идентификаторы событий в Redis, что позволяет клиентам возобновлять поток после обрыва соединения.【F:backend/gateway/src/sse/upstream-sse.service.ts†L22-L165】
- Каждые `GATEWAY_UPSTREAM_SSE_HEARTBEAT_INTERVAL` миллисекунд Gateway отправляет `event: heartbeat` с таймстампом для диагностики соединения и обновляет Redis-ключи для мониторинга состояния стрима.【F:backend/gateway/src/sse/upstream-sse.service.ts†L47-L115】
- Параметры подключений и таймауты задаются переменными `GATEWAY_UPSTREAM_*` (см. [`env.example`](../../env.example)).

## Канал `deals` (CRM)
- **Маршрут:** `GET /api/v1/streams/deals` — публичный поток изменений сделок и связанных объектов.
- **Назначение:** ретрансляция событий CRM (сделки, клиенты, документы) из внутреннего SSE-канала `GATEWAY_UPSTREAM_CRM_SSE_URL`.
- **Особенности:**
  - CRM API предоставляет upstream `GET ${GATEWAY_UPSTREAM_CRM_SSE_URL}` (по умолчанию `http://localhost:8082/streams`), который отдаёт ответы `text/event-stream`.
  - Upstream использует временную очередь RabbitMQ, подписанную на topic-exchange `${CRM_EVENTS_EXCHANGE}` (маршрут `#`). Exchange должен существовать до старта CRM; его создаёт `infra/rabbitmq/bootstrap.sh` или `EventsPublisher` при первой публикации события.
  - Gateway автоматически переподключается к upstream при обрывах с задержкой `GATEWAY_UPSTREAM_SSE_RECONNECT_DELAY`.
  - При восстановлении соединения используется значение `Last-Event-ID`, сохранённое в Redis (`${REDIS_HEARTBEAT_PREFIX}:crm:last-event-id`).
  - Payload передаётся без изменений; тип события (`event`) задаёт CRM.
- Обновления по платежам публикуются событиями `deal.payment.updated` (агрегат платежа) и `deal.payment.income.*`/`deal.payment.expense.*`; отдельного `deal.updated` больше нет.
- Для обратной совместимости внутренний upstream по-прежнему обозначается как `crm`; публичный маршрут и переменные окружения используют имя `deals`.
- **Алиас:** путь `/api/v1/streams/crm` остаётся рабочим для клиентов, которым требуется постепенная миграция на `deals`.
- Каждый канал использует `Last-Event-ID` для восстановления после обрыва.
- Все payload передаются в формате JSON, поле `event` — тип события, `data` — сериализованный объект.
- При изменении схемы события повышается версия канала (`?version=2`).

### Типы событий канала `deals`
- **Назначение:** оперативные изменения сделок, клиентов, расчётов и полисов.
- **Источник данных:** CRM/Deals публикует доменные события в RabbitMQ (`crm.events`, см. `CRM_EVENTS_EXCHANGE`), Gateway транслирует их в SSE.

| Тип события | Описание | Payload |
| --- | --- | --- |
| `deal.journal.appended` | Добавлена запись в журнал. | `{ "deal_id": "uuid", "entry_id": "uuid", "author_id": "uuid", "body": "string", "created_at": "datetime" }` |
| `deal.calculation.created`, `deal.calculation.updated` | Создан или обновлён расчёт. | `{ "calculation_id": "uuid", "deal_id": "uuid", "status": "draft", "insurance_company": "string", "calculation_date": "date", "premium_amount": "decimal", "policy_id": "uuid"\|null }` |
| `deal.calculation.deleted` | Расчёт удалён. | `{ "calculation_id": "uuid", "deal_id": "uuid", "status": "ready", "insurance_company": "string", "calculation_date": "date" }` |
| `deal.calculation.status.<code>` | Изменился статус расчёта (`<code>` ∈ `ready`, `confirmed`, `archived`). | `{ "calculation_id": "uuid", "deal_id": "uuid", "status": "confirmed", "insurance_company": "string", "calculation_date": "date", "policy_id": "uuid"\|null }` |
| `deal.payment.created`, `deal.payment.updated` | Создан или пересчитан платёж; payload включает агрегаты и вложенные доходы/расходы. | `{ "deal_id": "uuid", "policy_id": "uuid", "payment": { "payment_id": "uuid", "sequence": 1, "status": "posted", "planned_date": "date", "actual_date": "date"\|null, "incomes_total": "decimal", "expenses_total": "decimal", "net_total": "decimal", "incomes": [...], "expenses": [...] } }` |
| `deal.payment.deleted` | Платёж удалён. | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "deleted_at": "datetime" }` |
| `deal.payment.income.created`, `deal.payment.income.updated`, `deal.payment.income.deleted` | Изменения по доходам платежа. | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "income": { "income_id": "uuid", "amount": "decimal", "posted_at": "date", "note": "string"\|null, "deleted_at": "datetime"\|null }, "previous": { ... }\|null }` |
| `deal.payment.expense.created`, `deal.payment.expense.updated`, `deal.payment.expense.deleted` | Изменения по расходам платежа. | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "expense": { "expense_id": "uuid", "amount": "decimal", "posted_at": "date", "note": "string"\|null, "deleted_at": "datetime"\|null }, "previous": { ... }\|null }` |

**Ошибки канала:**
- `event: error` + `data: {"code": "forbidden"}` — пользователь не имеет доступа, соединение закрывается.
- `event: heartbeat` каждые 30 секунд для проверки соединения (payload пустой). Сообщение формируется upstream CRM через `sse-starlette`.

## Канал `notifications`
- **Маршрут:** `GET /api/v1/streams/notifications`
- **Назначение:** ретрансляция внутренних уведомлений CRM и откликов Telegram-бота (`GATEWAY_UPSTREAM_NOTIFICATIONS_SSE_URL`).
- **Upstream:** CRM предоставляет `GET ${GATEWAY_UPSTREAM_NOTIFICATIONS_SSE_URL}` (по умолчанию `http://localhost:8082/streams`).
- **Особенности:** идентичны каналу CRM, за исключением ключа Redis (`${REDIS_HEARTBEAT_PREFIX}:notifications`).

## Канал `heartbeat`
- **Маршрут:** `GET /api/v1/streams/heartbeat`
- **Назначение:** проверка доступности Gateway; события генерируются самим Gateway каждые 15 секунд и не требуют upstream-подключения.【F:backend/gateway/src/sse/sse.controller.ts†L4-L18】
- **Payload:** `{ "type": "heartbeat", "sequence": <номер сообщения> }`.

## Управление соединением
- Gateway поддерживает до 5 одновременных каналов на пользователя; при превышении старые соединения закрываются (поведение по умолчанию Nest SSE).
- При недоступности источника Gateway отправляет `event: heartbeat` и повторяет попытку подключения, пока upstream не станет доступен (возврат 503 клиенту не требуется).
- Для мониторинга состояния можно отслеживать Redis-ключи `REDIS_HEARTBEAT_PREFIX` — при отсутствии обновлений в течение `GATEWAY_UPSTREAM_SSE_HEARTBEAT_TTL` поток считается неактивным.
