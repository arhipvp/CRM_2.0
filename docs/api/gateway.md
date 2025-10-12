# Gateway / BFF API

## Общая информация
- **Базовый URL:** `/api/v1`
- **Аутентификация:** `Authorization: Bearer <JWT>` (токен, выданный Auth API)
- **Формат данных:** JSON, кодировка UTF-8
- **Версионирование:** версия фиксируется в URL (`/api/v1`). Изменения, нарушающие совместимость, публикуются как `/api/v2`.

## Эндпоинты сессии и профиля

### POST `/api/v1/session/login`
Авторизует пользователя и возвращает refresh-/access-токены.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| username | string | Да | Логин пользователя (email или телефон). |
| password | string | Да | Пароль пользователя. |
| totp_code | string | Нет | Одноразовый код, если для пользователя включён 2FA. |

**Ответ 200**
```json
{
  "access_token": "<jwt>",
  "expires_in": 900,
  "refresh_token": "<jwt>",
  "refresh_expires_in": 604800,
  "user": {
    "id": "uuid",
    "full_name": "string",
    "roles": ["agent"]
  }
}
```

**Ошибки**
| Код | Сообщение | Условия |
| --- | --- | --- |
| 400 | `invalid_payload` | Отсутствуют обязательные поля. |
| 401 | `invalid_credentials` | Неверный логин/пароль. |
| 401 | `otp_required` | Требуется одноразовый код. |
| 423 | `account_locked` | Аккаунт временно заблокирован после превышения числа попыток. |

### POST `/api/v1/session/refresh`
Обновляет access-токен по refresh-токену.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| refresh_token | string | Да | Действующий refresh-токен. |

**Ответ 200** — структура идентична `/session/login`.

**Ошибки:** `400 invalid_payload`, `401 invalid_token`, `401 token_expired`.

### POST `/api/v1/session/logout`
Инвалидирует refresh-токен и завершает активные SSE-сессии пользователя.

**Заголовки:** `Authorization`.

**Ответ 204** — без тела.

**Ошибки:** `401 invalid_token` (некорректный access-токен).

### GET `/api/v1/session/profile`
Возвращает информацию о текущем пользователе и его привязках к сущностям.

**Ответ 200**
```json
{
  "user": {
    "id": "uuid",
    "full_name": "string",
    "roles": ["agent", "financial_manager"],
    "telegram_linked": true,
    "last_login_at": "2024-02-18T08:11:23Z"
  },
  "permissions": {
    "clients": "own",
    "deals": "team",
    "documents": "own",
    "payments": "team"
  }
}
```

**Ошибки:** `401 invalid_token`.

## Агрегации для фронтенда

### GET `/api/v1/dashboard/summary`
Возвращает агрегированные показатели для главного экрана.

**Параметры запроса**
| Имя | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| horizon | string | Нет | Горизонт для расчёта метрик (`7d`, `30d`). По умолчанию `30d`. |

**Ответ 200**
```json
{
  "pipeline": {
    "draft": 8,
    "estimating": 5,
    "awaiting_client": 4,
    "issuing": 3,
    "active": 12
  },
  "payments": {
    "planned": 12,
    "expected": 6,
    "received": 9,
    "due_soon": 3
  },
  "tasks": {
    "overdue": 2,
    "due_today": 5,
    "upcoming": 7
  }
}
```

**Ошибки:** `401 invalid_token`.

### GET `/api/v1/deals/overview`
Возвращает список сделок с агрегированными данными (последние события, статусы платежей, назначенные пользователи).

**Параметры запроса**
| Имя | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| status | array[string] | Нет | Фильтр по статусам. |
| search | string | Нет | Поиск по названию сделки, клиенту, полису. |
| limit | integer | Нет | По умолчанию 25, максимум 100. |
| offset | integer | Нет | Смещение постраничной навигации. |

**Ответ 200**
```json
{
  "items": [
    {
      "deal": {
        "id": "uuid",
        "title": "КАСКО Fleet",
        "status": "issuing",
        "client": {
          "id": "uuid",
          "name": "ООО \"Ромашка\""
        }
      },
      "latest_journal": {
        "author": "uuid",
        "created_at": "2024-02-17T10:00:00Z",
        "text": "Получили согласование расчёта."
      },
      "payment_state": {
        "expected_amount": 250000,
        "received_amount": 150000,
        "next_due_date": "2024-02-28"
      },
      "assigned_users": [
        {"id": "uuid", "role": "agent"},
        {"id": "uuid", "role": "executor"}
      ]
    }
  ],
  "total": 32
}
```

**Ошибки:** `401 invalid_token`.

## Прокси к внутренним сервисам

Gateway обрабатывает валидацию и транзакции, затем вызывает соответствующие REST API.

### POST `/api/v1/deals`
Создаёт сделку и связанные сущности в CRM/Deals.

**Тело запроса** — см. `CRM/Deals API` (`POST /deals`). Gateway дополняет запрос данными пользователя.

**Ответ 201** — проксирует ответ CRM/Deals.

**Ошибки**
| Код | Сообщение | Условия |
| --- | --- | --- |
| 400 | `validation_error` | Ошибки схемы, дублирование клиента. |
| 403 | `forbidden` | Пользователь не имеет права создавать сделки. |
| 409 | `deal_conflict` | Сервис CRM вернул конфликт (например, сделка уже существует). |

### POST `/api/v1/payments/{payment_id}/confirm`
Подтверждает платеж, инициируя операции в Payments и CRM.

**Параметры пути**
| Имя | Тип | Описание |
| --- | --- | --- |
| payment_id | UUID | Идентификатор платежа. |

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| actual_date | date | Да | Дата фактического поступления/выплаты. |
| confirmation_reference | string | Нет | Номер платежного документа. |

**Ответ 200**
```json
{
  "status": "received",
  "confirmed_by": "uuid",
  "confirmed_at": "2024-02-18T09:20:00Z"
}
```

**Ошибки:** `400 validation_error`, `403 forbidden`, `404 payment_not_found`, `409 invalid_state`.

### POST `/api/v1/telegram/webhook`
Принимает события Telegram и маршрутизирует их к Notifications/CRM.

**Тело запроса** — оригинальный webhook JSON Telegram.

**Ответ 202** — подтверждает приём.

**Ошибки:** `400 invalid_signature`, `429 rate_limited`.

## Стандартные ошибки Gateway

| Код | Сообщение | Описание |
| --- | --- | --- |
| 400 | `validation_error` | Некорректный запрос после бизнес-валидации. |
| 401 | `invalid_token` | Токен отсутствует или не прошёл проверку. |
| 403 | `forbidden` | Пользователь не имеет доступа к ресурсу. |
| 404 | `not_found` | Ресурс не найден или скрыт политикой доступа. |
| 409 | `conflict` | Нарушение уникальности или конфликт версий данных. |
| 429 | `rate_limited` | Превышено ограничение запросов. |
| 500 | `internal_error` | Внутренняя ошибка при интеграции с сервисами. |
