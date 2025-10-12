# Notifications service

Сервис рассылает уведомления и управляет Telegram-ботом.

## Локальная разработка

* Для отладки webhook и Bot API включите mock-сервер, описанный в [docs/local-setup.md#интеграции](../../docs/local-setup.md#интеграции).
* Установите `TELEGRAM_MOCK_ENABLED=true` и `TELEGRAM_MOCK_SERVER_URL` с адресом заглушки. Перед деплоем на сервер очистите эти переменные и задайте реальный `TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBHOOK_URL`.
* Mock не проверяет квоты Telegram — массовые рассылки и работу с медиа перепроверьте в dev/stage.

Архитектурные детали сервиса см. в [`docs/tech-stack.md`](../../docs/tech-stack.md).
