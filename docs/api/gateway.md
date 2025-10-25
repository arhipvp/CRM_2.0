# Gateway / BFF API

## Общая информация
- **Базовый URL:** `/api/v1`
- **Назначение:** единая точка входа, которая проксирует REST-запросы к сервисам Auth и CRM/Deals без собственной бизнес-логики.
- **Аутентификация:** `Authorization: Bearer <JWT>` (токен, выданный Auth API).
- **Формат данных:** JSON, кодировка UTF-8.
- **Версионирование:** версия фиксируется в URL (`/api/v1`).

## Проксируемые маршруты
Gateway не публикует собственные BFF-эндпоинты. Все запросы пробрасываются во внутренние сервисы по правилам:

### POST `/api/v1/session/login`
Авторизует пользователя и возвращает refresh-/access-токены.

**Тело запроса**
| Поле | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| email | string | Да | Email пользователя. |
| password | string | Да | Пароль пользователя. |

**Ответ 200**
```json
{
  "access_token": "<jwt>",
  "expires_in": 900,
  "refresh_token": "<jwt>",
  "refresh_expires_in": 604800,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "enabled": true,
    "roles": [
      { "id": "uuid", "name": "ROLE_USER", "description": "Базовая роль" }
    ],
    "createdAt": "2024-02-18T08:10:03Z",
    "updatedAt": "2024-02-18T08:10:03Z"
  }
}
```

**Ошибки**
| Код | Сообщение | Условия |
| --- | --- | --- |
| 400 | `invalid_payload` | Отсутствуют обязательные поля. |
| 401 | `invalid_credentials` | Неверный email или пароль. |
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

> ℹ️ Значение `*` обозначает произвольный хвост пути: Gateway добавляет его к базовому URL upstream-сервиса и повторяет исходный HTTP-метод.

## Как работает прокси
Proxy-слой реализован в сервисе `RestProxyService` и контроллерах `v1/auth` и `v1/crm`.

- Базовые URL и таймауты для upstream-сервисов задаются переменными `GATEWAY_UPSTREAM_AUTH_BASE_URL`, `GATEWAY_UPSTREAM_CRM_BASE_URL` и соответствующими таймаутами (`GATEWAY_UPSTREAM_*_TIMEOUT`). При отсутствии URL используется service discovery через Consul по именам `GATEWAY_UPSTREAM_AUTH_SERVICE_NAME` и `GATEWAY_UPSTREAM_CRM_SERVICE_NAME`.【F:backend/gateway/src/config/upstreams.config.ts†L1-L70】
- `RestProxyService` копирует исходный метод, тело и query-параметры, очищает hop-by-hop заголовки (`connection`, `keep-alive`, `transfer-encoding` и др.) и проксирует запрос через `HttpService`. Ошибки upstream возвращаются клиенту в неизменном виде; сетевые ошибки приводят к ответу `503 upstream_unavailable`.【F:backend/gateway/src/http/proxy/rest-proxy.service.ts†L1-L144】
- Для CRM-прокси включена опциональная трансформация ответов: если ответ JSON-подобный, ключи рекурсивно переводятся в `camelCase`. Трансформация реализована в `camelCaseKeysTransformer` и применяется во всех маршрутах `/api/v1/crm/*`. Ответы Auth возвращаются без изменений. При редиректах заголовок `Location` переписывается на внешний адрес Gateway. 【F:backend/gateway/src/http/crm/crm.controller.ts†L1-L21】【F:backend/gateway/src/http/proxy/response-transformers.ts†L1-L87】【F:backend/gateway/src/http/proxy/rest-proxy.service.ts†L86-L198】

**Ответ 200**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "enabled": true,
    "roles": [
      { "id": "uuid", "name": "ROLE_USER", "description": "Базовая роль" }
    ],
    "createdAt": "2024-02-18T08:10:03Z",
    "updatedAt": "2024-02-18T08:10:03Z"
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

## Агрегированные эндпоинты

### GET `/api/v1/dashboard/summary`
Возвращает агрегированные показатели для главного экрана.

**Параметры запроса**
| Имя | Тип | Обязательное | Описание |
| --- | --- | --- | --- |
| horizon | string | Нет | Горизонт для расчёта метрик (`7d`, `30d`). По умолчанию `30d`. |

```bash
curl -i -H "Authorization: Bearer <JWT>" \
  "http://localhost:${GATEWAY_SERVICE_PORT:-8080}/api/v1/auth/health"

curl -i -H "Authorization: Bearer <JWT>" \
  "http://localhost:${GATEWAY_SERVICE_PORT:-8080}/api/v1/crm/deals"
```

Ответы должны соответствовать контрактам Auth и CRM/Deals, так как Gateway выступает прозрачным REST-прокси.
