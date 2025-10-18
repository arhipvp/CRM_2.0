# Telegram Bot Service

Сервис реализует сценарии быстрого создания сделок, подтверждения задач и контроля платежей через Telegram-бота. Архитектура и
интеграции соответствуют описанию в [docs/architecture/bot.md](../../docs/architecture/bot.md).

## Возможности

- приём обновлений Telegram через webhook с валидацией подписи;
- проверка пользователей и получение Telegram-привязок через Auth;
- создание черновиков сделок и обновление задач/платежей в CRM;
- публикация событий RabbitMQ в форматах CloudEvents (`deal.created`, `task.status.changed`, `deal.payment.updated`);
- подписка на события `notifications.notification.*` из RabbitMQ и доставка уведомлений пользователям в Telegram.

## Локальный запуск

```bash
cd backend/telegram-bot
poetry install
TELEGRAM_BOT_SERVICE_PORT=8090 poetry run telegram-bot-main  # при необходимости измените порт
```

Скрипт `telegram-bot-main` читает порт из переменной окружения `TELEGRAM_BOT_SERVICE_PORT`, поэтому при запуске можно указать
любой свободный порт. Аналогично для запуска через uvicorn используйте:

```bash
poetry run uvicorn telegram_bot.app:create_app --factory --host 0.0.0.0 --port ${TELEGRAM_BOT_SERVICE_PORT}
```

Webhook должен проксироваться через Gateway/BFF. Для тестирования используйте mock из Notifications (`TELEGRAM_MOCK_ENABLED=true`)
или локальный туннель.

## Команды бота

- `/new_deal` — мастера вопросов по клиенту и сделке, по завершении создаёт черновик в CRM и публикует событие `crm.deal.created`.
- `/confirm_task <task_id> [комментарий]` — переводит задачу в статус `done`, отправляет событие `tasks.task.status_changed`.
- `/confirm_payment <deal_id> <policy_id> <payment_id> [дата YYYY-MM-DD]` — подтверждает платёж, публикует событие
  `crm.deal.payment.updated`.

## Переменные окружения

| Переменная | Описание |
| --- | --- |
| `TELEGRAM_BOT_SERVICE_PORT` | Порт HTTP-сервера (по умолчанию 8089). |
| `TELEGRAM_BOT_BOT_TOKEN` | Токен Telegram Bot API. Для mock можно оставить `dev-mock-token`. |
| `TELEGRAM_BOT_BOT_API_BASE` | (опционально) URL mock Bot API (`http://localhost:8085/telegram`). |
| `TELEGRAM_BOT_WEBHOOK_SECRET` | Секрет подписи webhook-ов (`X-Telegram-Signature`). |
| `TELEGRAM_BOT_REDIS_URL` | Подключение к Redis (FSM, rate limiting). |
| `TELEGRAM_BOT_RABBITMQ_URL` | URL RabbitMQ (используется для публикации и потребления событий). |
| `TELEGRAM_BOT_RABBITMQ_EXCHANGE_CRM` | Exchange CRM (`crm.domain`). |
| `TELEGRAM_BOT_RABBITMQ_EXCHANGE_TASKS` | Exchange Tasks (`tasks.events`). |
| `TELEGRAM_BOT_RABBITMQ_EXCHANGE_NOTIFICATIONS` | Exchange Notifications (`notifications.events`). |
| `TELEGRAM_BOT_RABBITMQ_QUEUE_NOTIFICATIONS` | Очередь для событий Notifications (по умолчанию `telegram.bot.notifications`). |
| `TELEGRAM_BOT_RABBITMQ_QUEUE_CRM` | Очередь для CRM-событий (по умолчанию `telegram.bot.crm`). |
| `TELEGRAM_BOT_EVENT_SOURCE` | Значение `source` для CloudEvents (например, `crm.telegram-bot`). |
| `TELEGRAM_BOT_AUTH_BASE_URL` | Базовый URL Auth API (`http://localhost:8081/api`). |
| `TELEGRAM_BOT_AUTH_SERVICE_TOKEN` | Сервисный токен для Auth. |
| `TELEGRAM_BOT_CRM_BASE_URL` | Базовый URL CRM API (`http://localhost:8082/api`). |
| `TELEGRAM_BOT_CRM_SERVICE_TOKEN` | Сервисный токен CRM. |
| `TELEGRAM_BOT_DEFAULT_TENANT_ID` | (опционально) Тенант по умолчанию. |
| `TELEGRAM_BOT_NOTIFICATIONS_BASE_URL` | Базовый URL Notifications API (`http://localhost:8085/api/v1`). |
| `TELEGRAM_BOT_NOTIFICATIONS_SERVICE_TOKEN` | Сервисный токен Notifications. |
| `TELEGRAM_BOT_HEALTHCHECK_TOKEN` | Токен для `/health`. |
| `TELEGRAM_BOT_ENVIRONMENT` | Текущая среда (`dev`, `stage`, `prod`). |

Auth должен предоставлять внутренние эндпоинты:

- `GET /internal/telegram/users/{telegram_id}` — поиск пользователя по Telegram ID;
- `GET /internal/telegram/bindings/{user_id}` — получение Telegram-привязки по ID пользователя.

Обе операции возвращают `user_id`, `telegram_id`, `tenant_id`, `roles` и `active`.

## RabbitMQ

Сервис публикует события CloudEvents с заголовком `ce-specversion: 1.0`:

- `deal.created` (`crm.deal.created`) — при создании черновика `/new_deal`;
- `task.status.changed` (`tasks.task.status_changed`) — при подтверждении задач;
- `deal.payment.updated` (`crm.deal.payment.updated`) — при подтверждении платежей.

Подписчик `telegram.bot.notifications` привязан к `notifications.events` (routing key `notifications.*`) и формирует сообщения в Telegram по событиям `notifications.notification.dispatched`.

## Тесты

```bash
poetry run pytest
```

Юнит-тесты покрывают сценарии сервисов, интеграционные тесты проверяют обработку webhook-а Telegram с валидацией подписи.
