# CRM Notifications

## Общая информация
- **Базовый URL:** `https://crm.internal/api/v1`
- **Аутентификация:** JWT CRM.
- **Назначение:** доставка внутренних уведомлений и интеграция с Telegram-ботом; публичные события транслируются через SSE-канал `notifications`.
- **Ограничения первой поставки:** управление шаблонами и настройками каналов выполняется административными инструментами CRM, отдельного REST API для шаблонов нет.

## SSE `GET /streams/notifications`
Gateway проксирует поток уведомлений CRM. Канал доступен по маршруту `GET /api/v1/streams/notifications` и требует тех же заголовков, что и другие SSE-каналы (`Accept: text/event-stream`, `Authorization: Bearer <JWT>`). Поведение описано в разделе [docs/api/streams.md](streams.md#канал-notifications).

### Формат событий
Поток соответствует спецификации SSE. Каждое сообщение содержит `retry` с интервалом повторного подключения (по умолчанию 5 секунд) и два основных поля:

- `event` — ключ события уведомления. Для пользовательских уведомлений значение повторяет `eventKey`, переданный при постановке через `POST /api/v1/notifications`. Дополнительно сервис транслирует служебные события `notifications.telegram.sent`, `notifications.telegram.delivery` и `notifications.telegram.error`, которые отражают статус интеграции с Telegram.
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
CRM публикует события в очередь `telegram.bot.notifications`, которую обслуживает бот (`backend/telegram-bot`). Ответы (успешная доставка, ошибки) возвращаются в CRM по REST-вебхуку и транслируются в SSE.

## Ошибки
SSE канал возвращает стандартные ошибки Gateway (см. [docs/api/streams.md](streams.md#управление-соединением)). REST-эндоинты модуля задач/уведомлений CRM используют общий список ошибок CRM (см. [docs/api/crm-deals.md](crm-deals.md#стандартные-ошибки)).
