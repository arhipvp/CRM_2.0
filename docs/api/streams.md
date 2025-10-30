# SSE-каналы

Gateway публикует события через Server-Sent Events (SSE) для клиентов веб-интерфейса. Подключение выполняется по заголовкам `Accept: text/event-stream` и (при необходимости) `Authorization: Bearer <JWT>`.

| Переменная | Назначение | Значение по умолчанию |
| --- | --- | --- |
| `GATEWAY_UPSTREAM_TIMEOUT` | Максимальное время ожидания ответа upstream перед обрывом соединения. | `5000` мс |
| `GATEWAY_UPSTREAM_SSE_RECONNECT_DELAY` | Задержка между попытками переподключения к upstream SSE. | `3000` мс |
| `GATEWAY_UPSTREAM_SSE_HEARTBEAT_INTERVAL` | Интервал отправки heartbeat-событий Gateway в downstream и обновления состояния Redis. | `15000` мс |
| `GATEWAY_UPSTREAM_SSE_HEARTBEAT_TTL` | TTL ключей мониторинга heartbeat в Redis; после превышения поток считается неактивным. | `60` с |
| `GATEWAY_UPSTREAM_CRM_BASE_URL` | Базовый URL REST-роутов CRM, используемый Gateway для проксирования. | `http://localhost:8082/api/v1` |
| `GATEWAY_UPSTREAM_CRM_SSE_URL` | Внутренний SSE-канал CRM для публичного стрима `deals`. | `http://localhost:8082/streams` |
| `GATEWAY_UPSTREAM_CRM_SERVICE_NAME` | Имя CRM в сервис-дискавери/трассировке (используется в метриках и логах). | `crm-service` |
| `GATEWAY_UPSTREAM_NOTIFICATIONS_BASE_URL` | Базовый URL REST-роутов уведомлений CRM. | `http://localhost:8082/api/v1` |
| `GATEWAY_UPSTREAM_NOTIFICATIONS_SSE_URL` | Внутренний SSE-канал уведомлений CRM для стрима `notifications`. | `http://localhost:8082/api/v1/streams` |
| `GATEWAY_UPSTREAM_NOTIFICATIONS_SERVICE_NAME` | Имя сервиса уведомлений в сервис-дискавери/трассировке. | `crm-service` |

Полные значения приведены в [`env.example`](../../env.example#L224-L227) и [`env.example`](../../env.example#L310-L317). Переопределяйте параметры при развертывании в нестандартной сети (другие хосты/порты CRM), при вынесении уведомлений в отдельный сервис, а также при изменении политик таймаутов и мониторинга, чтобы согласовать Gateway с фактической конфигурацией upstream.

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
- Обновления по платежам (включая запись фактической оплаты и перерасчёт итоговых сумм) публикуются тем же каналом событием `deal.payment.updated` с полной моделью платежа.
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
| `deal.journal.appended` | Добавлена запись в журнал сделки. | `{ "deal_id": "uuid", "entry_id": "uuid", "author_id": "uuid", "body": "string", "created_at": "datetime" }` |
| `deal.calculation.created` | Создан расчёт по сделке. | `{ "deal_id": "uuid", "calculation_id": "uuid", "status": "<status>", "insurance_company": "string", "calculation_date": "date" }` |
| `deal.calculation.updated` | Обновлён расчёт (изменены параметры). | `{ "deal_id": "uuid", "calculation_id": "uuid", "status": "ready", "premium_amount": "12345.67" }` |
| `deal.calculation.deleted` | Удалён расчёт. | `{ "deal_id": "uuid", "calculation_id": "uuid", "status": "archived" }` |
| `deal.calculation.status.ready` | Расчёт переведён в состояние готовности. | `{ "deal_id": "uuid", "calculation_id": "uuid", "status": "ready" }` |
| `deal.calculation.status.confirmed` | Расчёт подтверждён и связан с полисом. | `{ "deal_id": "uuid", "calculation_id": "uuid", "status": "confirmed", "policy_id": "uuid" }` |
| `deal.calculation.status.archived` | Расчёт архивирован, связь с полисом удалена. | `{ "deal_id": "uuid", "calculation_id": "uuid", "status": "archived" }` |
| `deal.payment.created` | Запланирован новый платёж по полису. | `{ "deal_id": "uuid", "policy_id": "uuid", "payment": { "payment_id": "uuid", "planned_date": "date", "planned_amount": "1234.56", "currency": "RUB" } }` |
| `deal.payment.updated` | Обновлены параметры платежа (план, факт, суммы доходов/расходов). | `{ "deal_id": "uuid", "policy_id": "uuid", "payment": { ... полная модель платежа ... } }` |
| `deal.payment.deleted` | Удалён платёж без связанных транзакций. | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "deleted_at": "datetime" }` |
| `deal.payment.income.*` | Операции с доходами (создание/обновление/удаление). | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "income": { "income_id": "uuid", "posted_at": "date", "amount": "1234.56" } }` |
| `deal.payment.expense.*` | Операции с расходами (создание/обновление/удаление). | `{ "deal_id": "uuid", "policy_id": "uuid", "payment_id": "uuid", "expense": { "expense_id": "uuid", "posted_at": "date", "amount": "1234.56" } }` |

При изменении фактических оплат, пересчёте доходов или расходов `PaymentService` публикует `deal.payment.updated` вместе с соответствующим событием `deal.payment.income.*`/`deal.payment.expense.*`, чтобы клиенты получили целостную модель платежа для повторного рендеринга.【F:backend/crm/crm/domain/services.py†L1036-L1140】【F:backend/crm/crm/domain/services.py†L1213-L1305】

События статусов ограничены логикой `_is_transition_allowed`, которая описывает допустимые переходы и публикацию уведомлений для состояний `ready`, `confirmed` и `archived`.【F:backend/crm/crm/domain/services.py†L342-L423】

**Ошибки канала:**
- `event: error` + `data: {"code": "forbidden"}` — пользователь не имеет доступа, соединение закрывается.
- `event: heartbeat` каждые 30 секунд для проверки соединения (payload пустой). Сообщение формируется upstream CRM через `sse-starlette`.

## Канал `notifications`
- **Маршрут:** `GET /api/v1/streams/notifications`
- **Назначение:** ретрансляция внутренних уведомлений CRM и откликов Telegram-бота (`GATEWAY_UPSTREAM_NOTIFICATIONS_SSE_URL`).
- **Upstream:** CRM предоставляет `GET ${GATEWAY_UPSTREAM_NOTIFICATIONS_SSE_URL}` (по умолчанию `http://localhost:8082/api/v1/streams`). Без переопределения переменной поток не работает, потому что фактический маршрут CRM — `GET http://localhost:8082/api/notifications/stream`, и именно его следует задать в `GATEWAY_UPSTREAM_NOTIFICATIONS_SSE_URL`.
- **Особенности:** идентичны каналу CRM, за исключением ключа Redis (`${REDIS_HEARTBEAT_PREFIX}:notifications`).
- **Инструкция по настройке:** задайте `GATEWAY_UPSTREAM_NOTIFICATIONS_SSE_URL` в `.env` и `infra/docker-compose.yml`, чтобы Gateway подключался к правильному upstream-роуту уведомлений.

## Канал `heartbeat`
- **Маршрут:** `GET /api/v1/streams/heartbeat`
- **Назначение:** проверка доступности Gateway; события генерируются самим Gateway каждые 15 секунд и не требуют upstream-подключения.【F:backend/gateway/src/sse/sse.controller.ts†L4-L18】
- **Payload:** `{ "type": "heartbeat", "sequence": <номер сообщения> }`.

## Управление соединением
- Gateway поддерживает до 5 одновременных каналов на пользователя; при превышении старые соединения закрываются (поведение по умолчанию Nest SSE).
- При недоступности источника Gateway отправляет `event: heartbeat` и повторяет попытку подключения, пока upstream не станет доступен (возврат 503 клиенту не требуется).
- Для мониторинга состояния можно отслеживать Redis-ключи `REDIS_HEARTBEAT_PREFIX` — при отсутствии обновлений в течение `GATEWAY_UPSTREAM_SSE_HEARTBEAT_TTL` поток считается неактивным.
