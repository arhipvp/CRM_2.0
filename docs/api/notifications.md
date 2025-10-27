# CRM Notifications

## Общая информация
- **Базовый URL:** `https://crm.internal/api/v1`
- **Аутентификация:** JWT CRM.
- **Назначение:** доставка внутренних уведомлений и интеграция с Telegram-ботом; публичные события транслируются через SSE-канал `notifications`.
- **Ограничения первой поставки:** управление настройками каналов выполняется административными инструментами CRM.

## Шаблоны уведомлений

### GET `/api/v1/templates`
Возвращает список шаблонов уведомлений. Шаблоны сортируются по `key`, затем по `locale`.

**Параметры запроса**
| Параметр | Тип | Обязательный | Описание |
| --- | --- | --- | --- |
| `channel` | string | Нет | Фильтр по каналу доставки: `sse` или `telegram`. |
| `active` | boolean | Нет | Флаг активности шаблона. `true` возвращает только `status=active`, `false` — `status=inactive`. |

**Ответ 200** — массив объектов `NotificationTemplate`:
```json
{
  "id": "3f81221e-2c5b-4d91-8a78-8e2d566bbd93",
  "key": "deal.created",
  "channel": "telegram",
  "body": "Новая сделка {dealId}",
  "metadata": {
    "parseMode": "MarkdownV2"
  },
  "status": "active",
  "locale": "ru-RU",
  "created_at": "2024-07-28T12:00:00Z",
  "updated_at": "2024-07-28T12:05:00Z"
}
```

**Ошибки**
- `401 unauthorized` — отсутствует или просрочен JWT.
- `422 validation_error` — неверные значения фильтров (`channel`, `active`).

**Пример запроса**

```http
GET /api/v1/templates?channel=telegram&active=true HTTP/1.1
Authorization: Bearer <token>
```

### POST `/api/v1/templates`
Создаёт шаблон уведомления. Если поле `locale` не указано, используется значение по умолчанию из настроек CRM (`CRM_NOTIFICATIONS_TEMPLATES_DEFAULT_LOCALE`).

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| `key` | string | Да | Уникальный код шаблона в рамках канала. |
| `channel` | string | Да | Канал доставки: `sse` или `telegram`. |
| `body` | string | Да | Текст сообщения. |
| `metadata` | object | Нет | Дополнительные параметры рендеринга (например, `parseMode` для Telegram). По умолчанию `{}`. |
| `status` | string | Нет | `active` или `inactive`. По умолчанию `active`. |
| `locale` | string | Нет | Локаль шаблона (`ru-RU`, `en-US` и т. п.). Если не передана, подставляется значение по умолчанию. |

**Ответ 201** — объект `NotificationTemplate` в формате, описанном выше.

**Ошибки**
- `401 unauthorized` — отсутствует или просрочен JWT.
- `409 template_conflict` — существует шаблон с той же парой `key` + `channel`.
- `422 validation_error` — нарушены ограничения полей (`key`, `body`, `locale`).

**Пример запроса**

```http
POST /api/v1/templates HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "key": "deal.created",
  "channel": "telegram",
  "body": "Новая сделка {dealId}",
  "metadata": {
    "parseMode": "MarkdownV2"
  }
}
```

## Уведомления

### POST `/api/v1/notifications`
Ставит уведомление в очередь на доставку через доступные каналы.

**Тело запроса** — объект `NotificationCreate`:

| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| `eventKey` | string | Да | Ключ события (1–255 символов), который будет использован в шаблонизаторе и SSE. |
| `recipients` | array | Да | Список получателей. Каждый элемент — объект `NotificationRecipient` с полями `userId` (строка 1–255 символов) и опциональным `telegramId`. |
| `payload` | object | Да | Произвольная полезная нагрузка, доступная в шаблонах и отправляемая в SSE. |
| `channelOverrides` | array | Нет | Список каналов доставки, ограничивающий отправку (например, `telegram`, `sse`). Если не указано, используется конфигурация по умолчанию. |
| `deduplicationKey` | string | Нет | Ключ дедупликации (до 255 символов). При повторной отправке с тем же значением сервис вернёт конфликт. |

**Пример запроса**

```http
POST /api/v1/notifications HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "eventKey": "deal.created",
  "recipients": [
    { "userId": "user-1", "telegramId": "123456" }
  ],
  "payload": {
    "dealId": "deal-1",
    "title": "Новая сделка"
  },
  "channelOverrides": ["telegram"],
  "deduplicationKey": "deal-1:created"
}
```

**Ответ 202 Accepted**

```json
{
  "notification_id": "3b0b61c9-6d6c-4f2f-9f46-9fe2e03f46f2"
}
```

**Ошибки**
- `401 unauthorized` — отсутствует или просрочен JWT.
- `409 duplicate_notification` — уведомление с таким `deduplicationKey` уже поставлено в очередь.
- `422 validation_error` — нарушены ограничения схемы (`eventKey`, `recipients`, структура `payload`).
- `500 notification_dispatch_failed` — внутренняя ошибка постановки задачи на доставку.

### POST `/api/notifications/events`
Принимает произвольные внешние события для трансляции в CRM. Дополнительные поля полезной нагрузки уточняйте по коду
`NotificationEventsService.handle_incoming`, чтобы поддерживать документацию в актуальном состоянии.

**Тело запроса** — объект `NotificationEventIngest`:

| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| `id` | UUID | Да | Уникальный идентификатор события. |
| `source` | string | Да | Человекочитаемый источник события (например, `telegram`, `crm-billing`). |
| `type` | string | Да | Тип события; используется для маршрутизации и шаблонов. |
| `time` | string (date-time) | Да | Время возникновения события в формате ISO 8601. |
| `data` | object | Да | Полезная нагрузка события, произвольный JSON. |
| `chatId` | string | Нет | Идентификатор чата-назначения; используется при ручной адресации Telegram. |

**Пример запроса**

```http
POST /api/notifications/events HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "c4ba5b61-62fb-4c4c-8f48-0a8eab808f1c",
  "source": "crm-billing",
  "type": "payment.received",
  "time": "2024-08-01T12:34:56Z",
  "data": {
    "invoiceId": "inv-42",
    "amount": 12500,
    "currency": "RUB"
  }
}
```

**Ответ 202 Accepted** — событие принято и поставлено на обработку.

**Ошибки**
- `401 unauthorized` — отсутствует или просрочен JWT.
- `422 validation_error` — нарушены ограничения схемы (`NotificationEventIngest`).
- `500 notification_event_failed` — ошибка доставки события до внутренних потребителей.

## SSE `GET /streams/notifications`
Gateway проксирует поток уведомлений CRM. Канал доступен по маршруту `GET /api/v1/streams/notifications` и требует тех же заголовков, что и другие SSE-каналы (`Accept: text/event-stream`, `Authorization: Bearer <JWT>`). Поведение описано в разделе [docs/api/streams.md](streams.md#канал-notifications).

### Формат событий
Поток соответствует спецификации SSE. Каждое сообщение содержит `retry` с интервалом повторного подключения (по умолчанию 5 секунд) и два основных поля:

- `event` — ключ события уведомления. Для пользовательских уведомлений значение повторяет `eventKey`, переданный при постановке через `POST /api/v1/notifications`. Дополнительно сервис транслирует служебные события `notifications.telegram.sent`, `notifications.telegram.delivery`, `notifications.telegram.error` и `notifications.telegram.skipped`, которые отражают статус интеграции с Telegram (успешная отправка, подтверждение доставки, ошибка или пропуск отключённого канала соответственно).
- `data` — JSON с полями:
  - `eventType` — дублирует `event` для удобства клиента.
  - `payload` — полезная нагрузка события. Для пользовательских уведомлений она содержит исходные данные из `payload`, расширенные техническими полями (`notificationId`, список получателей, переопределения каналов и т. п.). Для Telegram-событий возвращаются параметры доставки (`messageId`, `status`, `reason`, `occurredAt`).

Пример события пользовательского уведомления:

```
event: deal.created
data: {
  "eventType": "deal.created",
  "payload": {
    "dealId": "deal-1",
    "title": "Test Deal",
    "notificationId": "3b0b61c9-6d6c-4f2f-9f46-9fe2e03f46f2",
    "recipients": [
      { "userId": "user-1", "telegramId": "123456" }
    ],
    "channelOverrides": ["telegram"]
  }
}
```

Пример служебного события Telegram:

```
event: notifications.telegram.delivery
data: {
  "eventType": "notifications.telegram.delivery",
  "payload": {
    "notificationId": "3b0b61c9-6d6c-4f2f-9f46-9fe2e03f46f2",
    "messageId": "587324912",
    "status": "delivered",
    "reason": null,
    "occurredAt": "2024-07-28T12:34:56.000Z"
  }
}
```

## RabbitMQ события
Модуль уведомлений использует выделенный exchange `notifications.exchange` (тип `topic`). Его параметры задаются переменными `CRM_NOTIFICATIONS_*`/`NOTIFICATIONS_*` (см. [`env.example`](../env.example)) и задействованы в двух потоках:

- **Публикация задач на доставку.** При постановке уведомления сервис отправляет сообщение с routing key `notifications.dispatch`. Полезная нагрузка включает `notificationId`, `eventKey`, исходный `payload`, список `recipients`, `channelOverrides` и (при наличии) `deduplicationKey`. Эти сообщения предназначены для рабочих процессов доставки (например, коннекторов к внешним каналам).
- **Приём внешних событий.** Сервис подписывается на очередь `notifications.events`, связанную с exchange `notifications.exchange` по шаблону `notifications.*`. Ожидаемая структура сообщения совпадает с `IncomingNotificationDto`: поля `id`, `source`, `type` (обычно повторяет `eventKey`), `time`, `data` и опционально `chatId`. Такие события записываются в журнал уведомлений, транслируются в SSE и инициируют отправку через Telegram.

## Интеграция с Telegram-ботом
CRM публикует события в очередь `telegram.bot.notifications`, которую обслуживает бот (`backend/telegram-bot`). Ответы (успешная доставка, ошибки) возвращаются в CRM по REST-вебхуку и транслируются в SSE. Если переменная окружения `CRM_NOTIFICATIONS_TELEGRAM_ENABLED=false`, модуль уведомлений фиксирует событие `notifications.telegram.skipped` и завершает обработку без попытки отправки в Telegram — статус уведомления остаётся `processed`.

## Ошибки
SSE канал возвращает стандартные ошибки Gateway (см. [docs/api/streams.md](streams.md#управление-соединением)). REST-эндоинты модуля задач/уведомлений CRM используют общий список ошибок CRM (см. [docs/api/crm-deals.md](crm-deals.md#стандартные-ошибки)).
