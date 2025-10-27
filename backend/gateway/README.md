# Gateway / BFF Service

## Назначение
Gateway — единая точка входа для клиентских приложений (CRM UI через BFF, Telegram-бот, внешние интеграции). Он проксирует REST-запросы в сервисы Auth и CRM/Deals, ретранслирует SSE-потоки и маршрутизирует внешние вебхуки без собственной бизнес-логики.【F:docs/architecture.md†L9-L66】【F:docs/tech-stack.md†L120-L142】

## Требования к окружению
- Node.js LTS (18+) и NestJS, менеджер пакетов pnpm/npm.【F:docs/tech-stack.md†L120-L138】
- Redis для служебных ключей SSE, Consul для service discovery (по мере интеграции).【F:docs/tech-stack.md†L126-L136】
- Настроенные переменные `GATEWAY_SERVICE_PORT`, `GATEWAY_BASE_URL`, `REDIS_URL`, `CONSUL_HTTP_ADDR` и `GATEWAY_UPSTREAM_*` согласно [`env.example`](../../env.example).

## Локальный запуск

1. Установите зависимости: `pnpm install` (поддерживается и `npm install`, но pnpm предпочтителен для всех Node-проектов репозитория).
2. Синхронизируйте `.env` через скрипт: `../../scripts/sync-env.sh backend/gateway`. Он предупредит о перезаписи существующего файла — при необходимости выберите `skip`. После копирования обновите секреты (`JWT_*`, `SESSION_SECRET`) и проверьте блоки `GATEWAY_UPSTREAM_*`, `REDIS_*`, `CONSUL_*`.
3. Запустите сервис в режиме разработки: `pnpm start:dev`. Приложение слушает `http://${GATEWAY_SERVICE_HOST}:${GATEWAY_SERVICE_PORT}/api`.
4. Для проверки доступности выполните `curl http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/health` — ответ должен содержать `"status":"ok"` и статусы Redis/Consul.
5. SSE-канал «heartbeat» доступен по адресу `http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/streams/heartbeat` и отдаёт регулярные сообщения, которые удобно использовать как smoke-тест клиентских подписчиков.【F:backend/gateway/src/sse/sse.controller.ts†L4-L29】
6. Основной CRM-поток публикуется как `http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/streams/deals`. Внутри Gateway он проксируется из upstream `crm`, который по умолчанию слушает `http://localhost:8082/streams`, поэтому параметры `GATEWAY_UPSTREAM_CRM_SSE_URL` и конфигурация потребителей (CRM UI, Telegram-бот, внешние интеграции) должны быть согласованы (см. [`env.example`](../../env.example)); для обратной совместимости доступен алиас `/api/v1/streams/crm`.
7. Для запуска e2e/контрактных тестов выполните `pnpm test` — в них поднимаются mock-сервисы и проверяется проксирование REST/SSE.

## REST и SSE прокси

- REST-контроллеры `v1/crm` и `v1/auth` проксируют все HTTP-методы в соответствующие upstream-сервисы с учётом `GATEWAY_UPSTREAM_*` переменных и fallback через Consul service discovery.【F:backend/gateway/src/http/crm/crm.controller.ts†L1-L22】【F:backend/gateway/src/http/auth/auth.controller.ts†L1-L22】【F:backend/gateway/src/http/proxy/rest-proxy.service.ts†L1-L212】
- CRM-прокси дополнительно приводит JSON-ответы к `camelCase`, поэтому структуры `Deal`, `Client`, `Payment` и др. соответствуют контракту клиентского UI без ручного маппинга на стороне потребителей.【F:backend/gateway/src/http/proxy/response-transformers.ts†L1-L87】
- Маршрут `v1/payments` больше не обслуживается Gateway и должен вызываться напрямую из сервиса платежей либо через иные интеграции.
- SSE-контроллер ретранслирует потоки CRM и Notifications, обеспечивает heartbeat и хранит последние Event ID/тайминги в Redis для graceful reconnect; публичный маршрут `deals` и алиас `crm` транслируют один и тот же upstream-поток CRM.【F:backend/gateway/src/sse/sse.controller.ts†L1-L38】【F:backend/gateway/src/sse/upstream-sse.service.ts†L1-L165】

## Интеграции Redis и Consul

- Redis используется как кэш (`CacheModule`) и для служебных ключей SSE. Провайдер поддерживает `mock://` URL для локальных тестов и graceful shutdown; не оставляйте `REDIS_URL` пустым — используйте `mock://gateway` либо удалите переменную, чтобы применился дефолт `redis://localhost:6379/0`.【F:backend/gateway/src/app.module.ts†L1-L53】【F:backend/gateway/src/integrations/redis/redis.module.ts†L1-L64】
- Consul клиент вынесен в отдельный модуль, health-check проверяет `status.leader`, а REST-прокси может запрашивать адреса по `serviceName` при отсутствии статического URL.【F:backend/gateway/src/integrations/consul/consul.module.ts†L1-L39】【F:backend/gateway/src/integrations/consul/consul.service.ts†L1-L43】【F:backend/gateway/src/http/health/consul.health-indicator.ts†L1-L33】

## Миграции и скрипты
- Gateway не использует собственную БД, поэтому каталог `migrations/` пуст. Контракты и схемы API храните в `schema/` (создайте при необходимости).
- Контрактные тесты можно запускать командой `pnpm test:contract` (добавить в `package.json`).

## Запуск в Docker
1. Перед сборкой убедитесь, что `.dockerignore` в корне сервиса скрывает артефакты разработки (`node_modules`, `dist`, `coverage`,
   временные `.env` и т.п.) — это сокращает размер контекста и ускоряет `docker build`, особенно в CI.
2. Соберите образ (например, на основе официального `node:18-alpine`). Команда использует BuildKit-флаг `--ignorefile`, чтобы
   Docker подхватил `backend/gateway/.dockerignore`, даже если сборка выполняется из корня монорепозитория:
   ```bash
   docker build -t gateway-bff:local \
     -f backend/gateway/docker/Dockerfile.gateway \
     --ignorefile backend/gateway/.dockerignore \
     .
   ```
   > Примечание: если выполнять сборку из каталога `backend/gateway`, достаточно `docker build -f docker/Dockerfile.gateway .` —
   Docker автоматически применит локальный `.dockerignore`.
3. Запустите контейнер, пробросив порт и Redis/Consul параметры:
   ```bash
   docker run --rm -p ${GATEWAY_SERVICE_PORT:-8080}:8080 \
     --env-file ../../env.example \
     gateway-bff:local
   ```

## Полезные ссылки
- Архитектурный обзор и роль BFF: [`docs/architecture.md`](../../docs/architecture.md#24-роль-gatewaybff).【F:docs/architecture.md†L49-L57】
- Технологический стек Gateway: [`docs/tech-stack.md`](../../docs/tech-stack.md#gateway--bff).【F:docs/tech-stack.md†L120-L142】
