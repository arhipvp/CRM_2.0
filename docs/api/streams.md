# SSE-каналы

Gateway публикует события через Server-Sent Events (SSE) для клиентов веб-интерфейса. Подключение выполняется по заголовкам `Accept: text/event-stream` и (при необходимости) `Authorization: Bearer <JWT>`.

## Общие правила
- Соединение поддерживается на уровне Gateway: `GET /api/v1/streams/{channel}`.
- Gateway передаёт upstream-заголовок `Last-Event-ID` и сохраняет полученные идентификаторы событий в Redis, что позволяет клиентам возобновлять поток после обрыва соединения.【F:backend/gateway/src/sse/upstream-sse.service.ts†L22-L165】
- Каждые `GATEWAY_UPSTREAM_SSE_HEARTBEAT_INTERVAL` миллисекунд Gateway отправляет `event: heartbeat` с таймстампом для диагностики соединения и обновляет Redis-ключи для мониторинга состояния стрима.【F:backend/gateway/src/sse/upstream-sse.service.ts†L47-L115】
- Параметры подключений и таймауты задаются переменными `GATEWAY_UPSTREAM_*` (см. [`env.example`](../../env.example)).

## Канал `crm`
- **Маршрут:** `GET /api/v1/streams/crm`
- **Назначение:** ретрансляция событий CRM (сделки, клиенты, документы) из внутреннего SSE-канала `GATEWAY_UPSTREAM_CRM_SSE_URL`.
- **Особенности:**
  - Gateway автоматически переподключается к upstream при обрывах с задержкой `GATEWAY_UPSTREAM_SSE_RECONNECT_DELAY`.
  - При восстановлении соединения используется значение `Last-Event-ID`, сохранённое в Redis (`${REDIS_HEARTBEAT_PREFIX}:crm:last-event-id`).
  - Payload передаётся без изменений; тип события (`event`) задаёт CRM.

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
