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
  - Gateway автоматически переподключается к upstream при обрывах с задержкой `GATEWAY_UPSTREAM_SSE_RECONNECT_DELAY`.
  - При восстановлении соединения используется значение `Last-Event-ID`, сохранённое в Redis (`${REDIS_HEARTBEAT_PREFIX}:crm:last-event-id`).
  - Payload передаётся без изменений; тип события (`event`) задаёт CRM.
- Для обратной совместимости внутренний upstream по-прежнему обозначается как `crm`; публичный маршрут и переменные окружения используют имя `deals`.
- **Алиас:** путь `/api/v1/streams/crm` остаётся рабочим для клиентов, которым требуется постепенная миграция на `deals`.
- Каждый канал использует `Last-Event-ID` для восстановления после обрыва.
- Все payload передаются в формате JSON, поле `event` — тип события, `data` — сериализованный объект.
- При изменении схемы события повышается версия канала (`?version=2`).

### Типы событий канала `deals`
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

## Канал `payments`
- **Маршрут:** `GET /api/v1/streams/payments` — поток статусов и графиков платежей (публичная переменная `NEXT_PUBLIC_PAYMENTS_SSE_URL`).
- **Назначение:** ретрансляция финансовых событий Payments в реальном времени для экранов CRM.
- **Особенности:**
  - Gateway подключается к upstream `GATEWAY_UPSTREAM_PAYMENTS_SSE_URL` и проксирует события без трансформаций payload (тип и структура совпадают с RabbitMQ `payments.events`).
  - При восстановлении соединения используется идентификатор события из Redis (`${REDIS_HEARTBEAT_PREFIX}:payments:last-event-id`), что позволяет возобновить поток без потери данных.【F:backend/gateway/src/sse/upstream-sse.service.ts†L22-L115】
  - Сердечные импульсы (`event: heartbeat`) формируются каждые `GATEWAY_UPSTREAM_SSE_HEARTBEAT_INTERVAL` миллисекунд; ключ состояния канала — `${REDIS_HEARTBEAT_PREFIX}:payments`.
  - Повторные подключения выполняются с задержкой `GATEWAY_UPSTREAM_SSE_RECONNECT_DELAY`; upstream поддерживает заголовок `Last-Event-ID` и отдаёт монотонно возрастающие идентификаторы событий.

### Типы событий канала `payments`
- **Источник данных:** сервис Payments транслирует в SSE те же доменные события, которые публикует в exchange `payments.events` (см. [`docs/integration-events.md`](../integration-events.md)).

| Тип события | Описание | Payload |
| --- | --- | --- |
| `payment.created` | Создан новый платёж или добавлена запись в график. | `{ "payment_id": "uuid", "deal_id": "uuid", "amount": 12345.67, "currency": "RUB", "planned_date": "date", "status": "planned" }` |
| `payment.status.changed` | Обновлён статус платежа, подтверждена оплата или возврат. | `{ "payment_id": "uuid", "status": "received", "actual_date": "date", "confirmed_by": "uuid", "version": 3 }` |
| `payment.overdue` | Платёж просрочен и требует внимания. | `{ "payment_id": "uuid", "deal_id": "uuid", "due_date": "date", "amount": 12345.67, "days_overdue": 5 }` |

**Ошибки канала:**
- `event: error` + `data: {"code": "upstream_unavailable"}` — Payments временно недоступен, Gateway продолжает попытки переподключения.
- `event: heartbeat` каждые 30 секунд для проверки соединения (payload содержит `upstream` и таймстамп).【F:backend/gateway/src/sse/upstream-sse.service.ts†L47-L115】

## Запланированные каналы (после первой поставки)

### Канал `tasks`
- **Статус:** отложен до последующих релизов; первая поставка ограничивается потоками сделок, платежей и внутренних уведомлений.
- **Назначение:** публикация обновлений задач и напоминаний из сервиса Tasks после расширения сценариев напоминаний.
- **Текущее состояние:** спецификация сохранена для ориентира, реализация появится после запуска первой версии.

| Тип события | Описание | Payload |
| --- | --- | --- |
| `task.created` | Создана новая задача. | `{ "task_id": "uuid", "subject": "string", "assignee_id": "uuid", "due_date": "date", "status": "new" }` |
| `task.updated` | Изменения по задаче. | `{ "task_id": "uuid", "changes": { "status": "waiting" }, "updated_at": "datetime" }` |
| `task.reminder` | Напоминание по задаче. | `{ "task_id": "uuid", "remind_at": "datetime", "channel": "sse" }` |

> Поле `channel` и перечень статусов задач остаются справочными и будут актуализированы перед реализацией канала.

## Канал `notifications`
- **Маршрут:** `GET /api/v1/streams/notifications`
- **Назначение:** ретрансляция внутренних уведомлений из Notifications API (`GATEWAY_UPSTREAM_NOTIFICATIONS_SSE_URL`).
- **Особенности:** идентичны каналу CRM, за исключением ключа Redis (`${REDIS_HEARTBEAT_PREFIX}:notifications`).

## Канал `heartbeat`
- **Маршрут:** `GET /api/v1/streams/heartbeat`
- **Назначение:** проверка доступности Gateway и фронтенда; события генерируются самим Gateway каждые 15 секунд и не требуют upstream-подключения.【F:backend/gateway/src/sse/sse.controller.ts†L4-L18】
- **Payload:** `{ "type": "heartbeat", "sequence": <номер сообщения> }`.

## Управление соединением
- Gateway поддерживает до 5 одновременных каналов на пользователя; при превышении старые соединения закрываются (поведение по умолчанию Nest SSE).
- При недоступности источника Gateway отправляет `event: heartbeat` и повторяет попытку подключения, пока upstream не станет доступен (возврат 503 клиенту не требуется).
- Для мониторинга состояния можно отслеживать Redis-ключи `REDIS_HEARTBEAT_PREFIX` — при отсутствии обновлений в течение `GATEWAY_UPSTREAM_SSE_HEARTBEAT_TTL` поток считается неактивным.
