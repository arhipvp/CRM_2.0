# Миграции схемы `notifications`

## Порядок миграций

1. `1700000000000-create-notification-events-table.ts` — базовая таблица `notification_events` для хранения входящих сообщений и статуса доставки в Telegram.
2. `1705000001000-create-notification-templates-table.ts` — таблица `notification_templates` с уникальным ключом `key` + `channel`, полями `locale`, `body`, `metadata`, `status` и временными метками.
2. `1710000000001-add-telegram-delivery-columns.ts` — дополнительные поля для идентификатора сообщения и статусов webhook-доставки.
3. `1715000000002-create-notifications-dispatch-tables.ts` — таблицы `notifications` и `notification_delivery_attempts` для API постановки уведомлений и учёта попыток доставки.

## Правила версионирования

* Используется формат `YYYYMMDDHHMMSS_описание.(ts|js)` для миграций TypeORM.
* Каждая миграция должна быть обратимой.
* При добавлении новых каналов доставки одновременно обновляйте справочники и seed-данные.
