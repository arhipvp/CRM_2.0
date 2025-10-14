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
    "roles": ["agent", "executor", "admin"],
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
    "awaiting_confirmation": 6,
    "paid": 9
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
Возвращает список сделок с агрегированными данными (последние события, сведения об оплате, назначенные пользователи).

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
      "payments": [
        {
          "id": "7a0b99f3-0d19-48db-b229-feb62ad633c7",
          "sequence": 1,
          "status": "partially_paid",
          "planned_date": "2024-03-01",
          "planned_amount": "150000.00",
          "currency": "RUB",
          "actual_date": null,
          "net_total": "80000.00"
        }
      ],
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

Gateway обрабатывает валидацию и транзакции, затем вызывает соответствующие REST API. Для базовых операций доступны универсальные маршруты, которые проксируют все HTTP-методы и пути, сохраняя заголовки и тело запроса. При отсутствии статического `GATEWAY_UPSTREAM_*_BASE_URL` адрес сервиса резолвится через Consul (`GATEWAY_UPSTREAM_*_SERVICE_NAME`).【F:backend/gateway/src/http/proxy/rest-proxy.service.ts†L1-L143】

| Маршрут | Upstream | Назначение | Примечания |
| --- | --- | --- | --- |
| `/{version}/crm/*` | `GATEWAY_UPSTREAM_CRM_BASE_URL` | Общий REST-прокси CRM/Deals/Clients | Поддерживает все HTTP-методы и query-параметры; fallback по Consul при пустом URL.【F:backend/gateway/src/http/crm/crm.controller.ts†L1-L22】 |
| `/{version}/auth/*` | `GATEWAY_UPSTREAM_AUTH_BASE_URL` | Авторизация и токены | Проксируется в Auth API для login/refresh/logout и проверки сессий.【F:backend/gateway/src/http/auth/auth.controller.ts†L1-L22】 |

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

### Проксирование платежей полиса
Gateway предоставляет typed-роуты поверх CRM Payments API. Все ответы соответствуют [`docs/api/payments.md`](payments.md).

| Метод и путь | Назначение | Примечания |
| --- | --- | --- |
| `GET /api/v1/deals/{deal_id}/policies/{policy_id}/payments` | Список платежей полиса. | Поддерживает query-параметры `status[]`, `include[]`, `limit`, `offset`. |
| `POST /api/v1/deals/{deal_id}/policies/{policy_id}/payments` | Создание платежа. | Тело запроса: `planned_amount` (обязательно), `currency`, `planned_date`, `comment`. |
| `GET /api/v1/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}` | Получение платежа. | Поддерживает `include[]=incomes`, `include[]=expenses`. |
| `PATCH /api/v1/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}` | Обновление платежа. | Допускает обновление плановых значений, комментария, `actual_date`, статуса. |
| `DELETE /api/v1/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}` | Удаление платежа. | Успешно только при отсутствии операций; иначе CRM вернёт `409 payment_has_transactions`. |
| `POST /api/v1/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/incomes` | Добавление поступления. | Тело запроса: `amount`, `currency`, `category`, `posted_at`, `note`. |
| `PATCH /api/v1/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/incomes/{income_id}` | Изменение поступления. | Поля `amount`, `category`, `posted_at`, `note` опциональны. |
| `DELETE /api/v1/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/incomes/{income_id}` | Удаление поступления. | 204 при успехе. |
| `POST /api/v1/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/expenses` | Добавление расхода. | Аналогично `/incomes`. |
| `PATCH /api/v1/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/expenses/{expense_id}` | Изменение расхода. | 200 с обновлённым объектом. |
| `DELETE /api/v1/deals/{deal_id}/policies/{policy_id}/payments/{payment_id}/expenses/{expense_id}` | Удаление расхода. | 204 при успехе. |

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

## SSE-каналы

Подробное описание потоков CRM/Notifications и heartbeat приведено в [`docs/api/streams.md`](./streams.md). Gateway хранит heartbeat и `Last-Event-ID` в Redis, а конфигурация upstream-задаётся переменными `GATEWAY_UPSTREAM_*`.【F:backend/gateway/src/sse/upstream-sse.service.ts†L1-L165】
