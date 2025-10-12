# Миграции схемы `notifications`

## Порядок миграций

1. `20240117130000_create_notifications.sql` — таблица `notifications`, индексы по статусу и каналу.
2. `20240117132000_create_delivery_attempts.sql` — таблица `delivery_attempts`, внешние ключи на уведомления.
3. `20240117134000_create_templates.sql` — таблицы `templates` и `channel_settings`.
4. `20240117140000_seed_notification_templates.sql` — базовые шаблоны (создание сделки, просрочка задачи, подтверждение платежа).

## Правила версионирования

* Используется формат `YYYYMMDDHHMMSS_описание.sql`.
* Каждая миграция должна быть обратимой: для `templates` и `channel_settings` предоставляется скрипт отката.
* При добавлении новых каналов обновляются конфигурации rate limiting и таблица `channel_settings` в одном релизе.
