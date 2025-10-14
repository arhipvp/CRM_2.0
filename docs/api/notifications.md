# Notifications API

## Общая информация
- **Базовый URL:** `https://notifications.internal/api/v1`
- **Аутентификация:** сервисный JWT + HMAC-подписи для внешних вебхуков
- **Назначение:** управление шаблонами уведомлений, постановка сообщений в очереди, подтверждение доставки.

## Шаблоны и каналы

### GET `/templates`
Список шаблонов уведомлений.

**Параметры запроса**
| Имя | Тип | Описание |
| --- | --- | --- |
| channel | string | Фильтр по каналу (`sse`, `telegram`). |
| active | boolean | `true` — только активные, `false` — только выключенные. |

**Ответ 200** — список шаблонов.

```json
[
  {
    "id": "6a5f9e46-262a-4b3e-bc92-9732bb0c027e",
    "key": "deal.status.changed",
    "channel": "telegram",
    "locale": "ru-RU",
    "body": "Здравствуйте, {{name}}!",
    "metadata": { "preview": "Статус изменён" },
    "status": "active",
    "createdAt": "2024-05-10T08:00:00.000Z",
    "updatedAt": "2024-05-10T08:00:00.000Z"
  }
]
```

### POST `/templates`
Создание шаблона.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| key | string | Да | Уникальный идентификатор (`deal.status.changed`). |
| channel | string | Да | Канал (`sse` или `telegram`). |
| locale | string | Нет | Код локали. Если не передан — используется значение из `NOTIFICATIONS_TEMPLATES_DEFAULT_LOCALE`. |
| body | string | Да | Тело шаблона (Mustache или plain text). |
| metadata | object | Нет | Дополнительные параметры для рендера или описания. |
| status | string | Нет | `active` (по умолчанию) или `inactive`. |

**Ответ 201** — созданный шаблон с полями, перечисленными выше.

**Ошибки:** `400 validation_error`, `409 template_conflict` (конфликт по паре `key` + `channel`).

## Постановка уведомлений

### POST `/notifications`
Формирует уведомление и ставит его в очередь доставки.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| eventKey | string | Да | Ключ события, выбирает шаблон. |
| recipients | array<object> | Да | Каждый объект содержит `userId`, опционально `telegramId`. |
| payload | object | Да | Данные для подстановки. |
| channelOverrides | array<string> | Нет | Список каналов (`sse`, `telegram`), если нужно переопределить шаблон. |
| deduplicationKey | string | Нет | Используется для идемпотентности (например, `task:uuid`). |

**Ответ 202** — уведомление поставлено в очередь, тело содержит `notification_id` (UUID записи в таблице `notifications`).

**Ошибки:** `400 validation_error`, `409 duplicate_notification` (повтор по `deduplicationKey`).

> ⚙️ Постановка идемпотентна: если указать `deduplicationKey` и повторить запрос, сервис вернёт `409 duplicate_notification`, не создавая дублирующих записей и попыток доставки.

#### Внутренний пайплайн

1. **Сохранение записи.** Запрос создаёт строку в таблице `notifications` со статусом `pending`.
2. **RabbitMQ.** Событие публикуется в `NOTIFICATIONS_DISPATCH_EXCHANGE` с ключом `NOTIFICATIONS_DISPATCH_ROUTING_KEY` (по умолчанию `notifications.dispatch`). Сообщение персистентное, что позволяет восстанавливать очередь после рестарта брокера.
3. **Redis.** В канал `NOTIFICATIONS_DISPATCH_REDIS_CHANNEL` отправляется то же сообщение — используется для локальных слушателей и отладки.
4. **Внутренний обработчик.** Сервис синхронно вызывает текущий `NotificationEventsService`, который создаёт записи в `notification_events` и транслирует событие в SSE/Telegram.
5. **Повторы.** RabbitMQ, Redis и внутренний обработчик используют единый механизм повторов. При ошибке попытка фиксируется как `failure`, сервис ждёт `NOTIFICATIONS_DISPATCH_RETRY_DELAY_MS` миллисекунд и повторяет публикацию до `NOTIFICATIONS_DISPATCH_RETRY_ATTEMPTS` раз.
6. **Статусы и попытки.** Каждое действие записывается в `notification_delivery_attempts` (канал, статус, метаданные, ошибка). Итоговый статус уведомления (`processed`, `failed`) отражается в таблице `notifications`, поле `attemptsCount` содержит общее число записанных попыток.

Параметры повторов управляются переменными окружения:

- `NOTIFICATIONS_DISPATCH_RETRY_ATTEMPTS` — максимальное количество повторных публикаций на асинхронных каналах (по умолчанию 3).
- `NOTIFICATIONS_DISPATCH_RETRY_DELAY_MS` — задержка между повторными публикациями в миллисекундах (по умолчанию 60000). Значения применяются ко всем каналам; если после исчерпания попыток ошибка сохраняется, уведомление получает статус `failed`.

Брокеру Redis требуется префикс `NOTIFICATIONS_REDIS_PREFIX`, по умолчанию `notifications:`.

### GET `/notifications/{notification_id}`
Проверка статуса доставки.

**Ответ 200**
```json
{
  "id": "uuid",
  "status": "delivered",
  "attempts": 1,
  "channels": ["telegram"],
  "delivered_at": "2024-02-18T08:30:00Z"
}
```

**Ошибки:** `404 notification_not_found`.

## Telegram webhook

### POST `/telegram/delivery`
Принимает обратные вызовы от Telegram-бота (доставлено, ошибка). Эндпоинт доступен по адресу
`POST https://notifications.internal/api/v1/telegram/delivery` и требует HMAC-подпись запроса.

**Заголовки**

| Имя | Тип | Описание |
| --- | --- | --- |
| `X-Telegram-Signature` | string | HMAC-SHA256 хеш тела запроса в шестнадцатеричном виде. Секрет задаётся через `NOTIFICATIONS_TELEGRAM_WEBHOOK_SECRET`. |

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| messageId | string | Да | Идентификатор сообщения Telegram. |
| status | string | Да | `delivered` или `failed`. |
| reason | string | Нет | Текст ошибки доставки. |
| occurredAt | datetime | Да | Время события в формате ISO 8601. |

**Ответ 200**
```json
{ "status": "ok" }
```

**Ошибки:** `400 validation_error`, `401 invalid_signature`, `403 telegram_webhook_disabled`.

> TODO: дополнить спецификацию эндпоинтами для экспорта журнала и управления автоподписками после реализации (см. `docs/delivery-plan.md`, раздел «Этап 1.1»).

## Стандартные ошибки Notifications API

| Код | Сообщение | Описание |
| --- | --- | --- |
| 400 | `validation_error` | Ошибка входных данных. |
| 401 | `unauthorized` | Неверный токен. |
| 403 | `forbidden` | Нет прав на управление шаблонами. |
| 404 | `not_found` | Шаблон/уведомление не найден. |
| 409 | `conflict` | Конфликт по ключу или дублирование. |
| 429 | `rate_limited` | Превышена квота отправки. |
| 500 | `internal_error` | Внутренняя ошибка сервиса. |
