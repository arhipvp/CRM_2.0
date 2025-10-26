# Gateway / BFF API

## Общая информация
- **Базовый URL:** `/api/v1`
- **Назначение:** единая точка входа, которая проксирует REST-запросы к сервисам Auth и CRM/Deals без собственной бизнес-логики.
- **Аутентификация:** `Authorization: Bearer <JWT>` (токен, выданный Auth API).
- **Формат данных:** JSON, кодировка UTF-8.
- **Версионирование:** версия фиксируется в URL (`/api/v1`).

## Проксируемые маршруты
Gateway не публикует собственные BFF-эндпоинты. Все запросы пробрасываются во внутренние сервисы без изменения контрактов:

| Внешний путь | Upstream | Особенности |
| --- | --- | --- |
| `/api/v1/auth/*` | Auth API | Полный хвост пути добавляется к значению `GATEWAY_UPSTREAM_AUTH_BASE_URL`. Gateway не трансформирует ответы, повторяя статус и тело upstream. |
| `/api/v1/crm/*` | CRM/Deals API | Хвост пути проксируется в CRM. Ответы дополнительно прогоняются через `camelCaseKeysTransformer`, чтобы вернуть camelCase ключи во внешнем API. |

> ℹ️ Значение `*` обозначает произвольный хвост пути: Gateway добавляет его к базовому URL upstream-сервиса и повторяет исходный HTTP-метод.

### `/api/v1/auth/*`
- Используется для всех запросов к Auth API, включая выдачу и обновление токенов (`POST /token`, `POST /refresh`) и получение профиля (`GET /me`).
- Конечный URL формируется сложением `GATEWAY_UPSTREAM_AUTH_BASE_URL` и хвоста пути. Например, при базовом значении `http://localhost:8081/api/auth` запрос `POST /api/v1/auth/token` проксируется в `POST http://localhost:8081/api/auth/token`.
- Контракты эндпоинтов описаны в разделе [Auth API](./auth.md).

### `/api/v1/crm/*`
- Проксирует REST-контракт CRM/Deals (`/clients`, `/deals`, `/deals/{id}/tasks` и т.д.).
- Ответы JSON преобразуются в camelCase перед отправкой клиенту, чтобы фронтенд использовал единый стиль именования ключей.
- Полные описания маршрутов смотрите в документации [CRM/Deals API](./crm-deals.md).

## Как работает прокси
Proxy-слой реализован в сервисе `RestProxyService` и контроллерах `v1/auth` и `v1/crm`.

- Базовые URL и таймауты для upstream-сервисов задаются переменными `GATEWAY_UPSTREAM_AUTH_BASE_URL`, `GATEWAY_UPSTREAM_CRM_BASE_URL` и соответствующими таймаутами (`GATEWAY_UPSTREAM_*_TIMEOUT`). При отсутствии URL используется service discovery через Consul по именам `GATEWAY_UPSTREAM_AUTH_SERVICE_NAME` и `GATEWAY_UPSTREAM_CRM_SERVICE_NAME`.【F:backend/gateway/src/config/upstreams.config.ts†L1-L70】
- `RestProxyService` копирует исходный метод, тело и query-параметры, очищает hop-by-hop заголовки (`connection`, `keep-alive`, `transfer-encoding` и др.) и проксирует запрос через `HttpService`. Ошибки upstream возвращаются клиенту в неизменном виде; сетевые ошибки приводят к ответу `503 upstream_unavailable`.【F:backend/gateway/src/http/proxy/rest-proxy.service.ts†L1-L144】
- Для CRM-прокси включена опциональная трансформация ответов: если ответ JSON-подобный, ключи рекурсивно переводятся в `camelCase`. Трансформация реализована в `camelCaseKeysTransformer` и применяется во всех маршрутах `/api/v1/crm/*`. Ответы Auth возвращаются без изменений. При редиректах заголовок `Location` переписывается на внешний адрес Gateway. 【F:backend/gateway/src/http/crm/crm.controller.ts†L1-L21】【F:backend/gateway/src/http/proxy/response-transformers.ts†L1-L87】【F:backend/gateway/src/http/proxy/rest-proxy.service.ts†L86-L198】

## Планы

Агрегированные BFF-эндпоинты (например, `/api/v1/dashboard/summary`) в текущей версии не реализованы. Рассматриваем их для последующих этапов, когда появятся дополнительные витрины и потребность в объединении данных нескольких сервисов.
