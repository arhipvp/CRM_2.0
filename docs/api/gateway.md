# Gateway / BFF API

## Общая информация
- **Базовый URL:** `/api/v1`
- **Назначение:** единая точка входа, которая проксирует REST-запросы к сервисам Auth и CRM/Deals без собственной бизнес-логики.
- **Аутентификация:** `Authorization: Bearer <JWT>` (токен, выданный Auth API).
- **Формат данных:** JSON, кодировка UTF-8.
- **Версионирование:** версия фиксируется в URL (`/api/v1`).

## Проксируемые маршруты
Gateway не публикует собственные BFF-эндпоинты. Все запросы пробрасываются во внутренние сервисы по правилам:

| Маршрут | Upstream | Особенности |
| --- | --- | --- |
| `/api/v1/auth/*` | Auth (`GATEWAY_UPSTREAM_AUTH_*`) | Проксируются все HTTP-методы и query-параметры. Ответы возвращаются без трансформаций. |
| `/api/v1/crm/*` | CRM/Deals (`GATEWAY_UPSTREAM_CRM_*`) | Проксируются все HTTP-методы. JSON-ответы автоматически приводятся к `camelCase` для совместимости с клиентским UI. |

> ℹ️ Значение `*` обозначает произвольный хвост пути: Gateway добавляет его к базовому URL upstream-сервиса и повторяет исходный HTTP-метод.

## Как работает прокси
Proxy-слой реализован в сервисе `RestProxyService` и контроллерах `v1/auth` и `v1/crm`.

- Базовые URL и таймауты для upstream-сервисов задаются переменными `GATEWAY_UPSTREAM_AUTH_BASE_URL`, `GATEWAY_UPSTREAM_CRM_BASE_URL` и соответствующими таймаутами (`GATEWAY_UPSTREAM_*_TIMEOUT`). При отсутствии URL используется service discovery через Consul по именам `GATEWAY_UPSTREAM_AUTH_SERVICE_NAME` и `GATEWAY_UPSTREAM_CRM_SERVICE_NAME`.【F:backend/gateway/src/config/upstreams.config.ts†L1-L70】
- `RestProxyService` копирует исходный метод, тело и query-параметры, очищает hop-by-hop заголовки (`connection`, `keep-alive`, `transfer-encoding` и др.) и проксирует запрос через `HttpService`. Ошибки upstream возвращаются клиенту в неизменном виде; сетевые ошибки приводят к ответу `503 upstream_unavailable`.【F:backend/gateway/src/http/proxy/rest-proxy.service.ts†L1-L144】
- Для CRM-прокси включена опциональная трансформация ответов: если ответ JSON-подобный, ключи рекурсивно переводятся в `camelCase`. Трансформация реализована в `camelCaseKeysTransformer` и применяется во всех маршрутах `/api/v1/crm/*`. Ответы Auth возвращаются без изменений. При редиректах заголовок `Location` переписывается на внешний адрес Gateway. 【F:backend/gateway/src/http/crm/crm.controller.ts†L1-L21】【F:backend/gateway/src/http/proxy/response-transformers.ts†L1-L87】【F:backend/gateway/src/http/proxy/rest-proxy.service.ts†L86-L198】

## Проверка доступности
Для экспресс-проверки используйте `curl`:

```bash
curl -i -H "Authorization: Bearer <JWT>" \
  "http://localhost:${GATEWAY_SERVICE_PORT:-8080}/api/v1/auth/health"

curl -i -H "Authorization: Bearer <JWT>" \
  "http://localhost:${GATEWAY_SERVICE_PORT:-8080}/api/v1/crm/deals"
```

Ответы должны соответствовать контрактам Auth и CRM/Deals, так как Gateway выступает прозрачным REST-прокси.
