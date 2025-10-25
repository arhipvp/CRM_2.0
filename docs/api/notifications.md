# CRM Notifications

## Общая информация
- **Базовый URL:** `https://crm.internal/api/v1`
- **Аутентификация:** JWT CRM.
- **Назначение:** доставка внутренних уведомлений и интеграция с Telegram-ботом; публичные события транслируются через SSE-канал `notifications`.
- **Ограничения первой поставки:** управление шаблонами и настройками каналов выполняется административными инструментами CRM, отдельного REST API для шаблонов нет.

## SSE `GET /streams/notifications`
Gateway проксирует поток уведомлений CRM. Канал доступен по маршруту `GET /api/v1/streams/notifications` и требует тех же заголовков, что и другие SSE-каналы (`Accept: text/event-stream`, `Authorization: Bearer <JWT>`). Поведение описано в разделе [docs/api/streams.md](streams.md#канал-notifications).

### Формат событий
- Поле `event` соответствует типу уведомления (`notification.created`, `notification.delivered`, `notification.failed`).
- Поле `data` содержит сериализованный JSON с полезной нагрузкой (идентификаторы уведомления, получателя и связанные сущности CRM).
- При наличии `id` значение используется для `Last-Event-ID`, чтобы Gateway мог восстановить поток после обрыва соединения.

## RabbitMQ события
Встроенный модуль уведомлений CRM публикует и потребляет события из exchange `crm.events`:
- `notification.created` — новое уведомление поставлено в очередь доставки.
- `notification.delivered` — получено подтверждение доставки (например, от Telegram-бота).
- `notification.failed` — доставка не удалась после исчерпания повторов.

Используйте переменные `CRM_EVENTS_EXCHANGE`, `CRM_TASKS_EVENTS_*` и `CRM_CELERY_*` из [`env.example`](../env.example), чтобы настроить публикацию и обработку уведомлений во всех окружениях.

## Интеграция с Telegram-ботом
CRM публикует события в очередь `telegram.bot.notifications`, которую обслуживает бот (`backend/telegram-bot`). Ответы (успешная доставка, ошибки) возвращаются в CRM по REST-вебхуку и транслируются в SSE.

## Ошибки
SSE канал возвращает стандартные ошибки Gateway (см. [docs/api/streams.md](streams.md#управление-соединением)). REST-эндоинты модуля задач/уведомлений CRM используют общий список ошибок CRM (см. [docs/api/crm-deals.md](crm-deals.md#стандартные-ошибки)).
