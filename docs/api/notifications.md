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
| channel | array[string] | `sse`, `telegram`. |
| active | boolean | Только активные шаблоны. |

**Ответ 200** — список шаблонов с версиями.

### POST `/templates`
Создание/обновление шаблона.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| key | string | Да | Уникальный идентификатор (`deal.status.changed`). |
| channel | string | Да | Канал (`sse` или `telegram`). |
| locale | string | Нет | Код локали (по умолчанию `ru-RU`). |
| subject | string | Нет | Заголовок (для отображения в потоке SSE). |
| body | string | Да | Шаблон в формате Mustache. |
| metadata | object | Нет | Доп. параметры. |

**Ответ 201** — созданный шаблон.

**Ошибки:** `400 validation_error`, `409 template_conflict`.

## Постановка уведомлений

### POST `/notifications`
Формирует уведомление и ставит его в очередь доставки.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| event_key | string | Да | Ключ события, выбирает шаблон. |
| recipients | array<object> | Да | Каждый объект содержит `user_id`, опционально `telegram_id`. |
| channel_overrides | array<string> | Нет | Список каналов (`sse`, `telegram`), если нужно переопределить шаблон. |
| payload | object | Да | Данные для подстановки. |
| deduplication_key | string | Нет | Используется для идемпотентности (например, `task:uuid`). |

**Ответ 202** — уведомление поставлено в очередь (`notification_id`).

**Ошибки:** `400 validation_error`, `409 duplicate_notification` (повтор по `deduplication_key`).

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
Принимает обратные вызовы от Telegram-бота (доставлено, прочитано).

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| message_id | string | Да | Идентификатор сообщения. |
| status | string | Да | `delivered`, `failed`. |
| reason | string | Нет | Текст ошибки. |
| occurred_at | datetime | Да | Время события. |

**Ответ 204** — без тела.

**Ошибки:** `400 validation_error`, `401 invalid_signature`.

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
