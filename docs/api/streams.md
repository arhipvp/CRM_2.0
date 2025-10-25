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
- Обновления по платежам (добавление даты фактической оплаты) публикуются тем же каналом с событием `deal.updated` и соответствующим блоком в payload.
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
| `deal.created` | Создана новая сделка. | `{ "deal_id": "uuid", "client_id": "uuid", "title": "string", "status": "draft", "created_at": "datetime" }` |
| `deal.updated` | Изменились реквизиты сделки. | `{ "deal_id": "uuid", "changes": { "status": "issuing" }, "updated_at": "datetime", "version": 5 }` |
| `deal.journal.appended` | Добавлена запись в журнал. | `{ "deal_id": "uuid", "entry_id": "uuid", "author_id": "uuid", "text": "string", "created_at": "datetime" }` |
| `policy.status.changed` | Полис сменил статус. | `{ "policy_id": "uuid", "deal_id": "uuid", "status": "active", "effective_from": "date", "effective_to": "date" }` |
| `calculation.added` | Добавлен расчёт. | `{ "calculation_id": "uuid", "deal_id": "uuid", "insurance_company": "string", "premium_amount": 12345.67 }` |

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
