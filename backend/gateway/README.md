# Gateway / BFF Service

## Назначение
Gateway — единая точка входа для веб-клиента и Telegram-бота. Он оркестрирует синхронные запросы, управляет сессиями, проксирует REST и SSE каналы к внутренним сервисам и маршрутизирует внешние вебхуки.【F:docs/architecture.md†L9-L66】【F:docs/tech-stack.md†L120-L142】

## Требования к окружению
- Node.js LTS (18+) и NestJS, менеджер пакетов pnpm/npm.【F:docs/tech-stack.md†L120-L138】
- Redis для хранения сессий и кеша, Consul для service discovery (по мере интеграции).【F:docs/tech-stack.md†L126-L136】
- Настроенные переменные `GATEWAY_SERVICE_PORT`, `GATEWAY_BASE_URL`, `REDIS_URL`, `CONSUL_HTTP_ADDR` и `GATEWAY_UPSTREAM_*` согласно [`env.example`](../../env.example).

## Локальный запуск

1. Установите зависимости: `pnpm install` (поддерживается и `npm install`, но pnpm предпочтителен для всех Node-проектов репозитория).
2. Синхронизируйте `.env` через скрипт: `../../scripts/sync-env.sh backend/gateway`. Он предупредит о перезаписи существующего файла — при необходимости выберите `skip`. После копирования обновите секреты (`JWT_*`, `SESSION_SECRET`) и проверьте блоки `GATEWAY_UPSTREAM_*`, `REDIS_*`, `CONSUL_*`.
3. Запустите сервис в режиме разработки: `pnpm start:dev`. Приложение слушает `http://${GATEWAY_SERVICE_HOST}:${GATEWAY_SERVICE_PORT}/api`.
4. Для проверки доступности выполните `curl http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/health` — ответ должен содержать `"status":"ok"` и статусы Redis/Consul.
5. SSE-канал «heartbeat» доступен по адресу `http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/streams/heartbeat` и отдаёт регулярные сообщения, которые удобно использовать как smoke-тест подключения фронтенда.【F:backend/gateway/src/sse/sse.controller.ts†L4-L29】
6. Основной CRM-поток публикуется как `http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/streams/deals`. Внутри Gateway он проксируется из upstream `crm`, поэтому параметры `GATEWAY_UPSTREAM_CRM_SSE_URL` и `NEXT_PUBLIC_CRM_SSE_URL` должны быть согласованы (см. [`env.example`](../../env.example)); для обратной совместимости доступен алиас `/api/v1/streams/crm`.
7. Для запуска e2e/контрактных тестов выполните `pnpm test` — в них поднимаются mock-сервисы и проверяется проксирование REST/SSE.

## REST и SSE прокси

- REST-контроллеры `v1/crm`, `v1/payments`, `v1/auth` проксируют все HTTP-методы в соответствующие upstream-сервисы с учётом `GATEWAY_UPSTREAM_*` переменных и fallback через Consul service discovery.【F:backend/gateway/src/http/crm/crm.controller.ts†L1-L22】【F:backend/gateway/src/http/payments/payments.controller.ts†L1-L22】【F:backend/gateway/src/http/auth/auth.controller.ts†L1-L22】【F:backend/gateway/src/http/proxy/rest-proxy.service.ts†L1-L143】
- SSE-контроллер ретранслирует потоки CRM и Notifications, обеспечивает heartbeat и хранит последние Event ID/тайминги в Redis для graceful reconnect; публичный маршрут `deals` и алиас `crm` транслируют один и тот же upstream-поток CRM.【F:backend/gateway/src/sse/sse.controller.ts†L1-L38】【F:backend/gateway/src/sse/upstream-sse.service.ts†L1-L165】

## Интеграции Redis и Consul

- Redis используется как кэш (`CacheModule`) и для служебных ключей SSE. Провайдер поддерживает `mock://` URL для локальных тестов и graceful shutdown.【F:backend/gateway/src/app.module.ts†L1-L53】【F:backend/gateway/src/integrations/redis/redis.module.ts†L1-L64】
- Consul клиент вынесен в отдельный модуль, health-check проверяет `status.leader`, а REST-прокси может запрашивать адреса по `serviceName` при отсутствии статического URL.【F:backend/gateway/src/integrations/consul/consul.module.ts†L1-L39】【F:backend/gateway/src/integrations/consul/consul.service.ts†L1-L43】【F:backend/gateway/src/http/health/consul.health-indicator.ts†L1-L33】

## Миграции и скрипты
- Gateway не использует собственную БД, поэтому каталог `migrations/` пуст. Контракты и схемы API храните в `schema/` (создайте при необходимости).
- Контрактные тесты можно запускать командой `pnpm test:contract` (добавить в `package.json`).

## Запуск в Docker
1. Соберите образ (например, на основе официального `node:18-alpine`):
   ```bash
   docker build -t gateway-bff:local -f docker/Dockerfile.gateway .
   ```
2. Запустите контейнер, пробросив порт и Redis/Consul параметры:
   ```bash
   docker run --rm -p ${GATEWAY_SERVICE_PORT:-8080}:8080 \
     --env-file ../../env.example \
     gateway-bff:local
   ```

## Полезные ссылки
- Архитектурный обзор и роль BFF: [`docs/architecture.md`](../../docs/architecture.md#24-роль-gatewaybff).【F:docs/architecture.md†L49-L57】
- Технологический стек Gateway: [`docs/tech-stack.md`](../../docs/tech-stack.md#gateway--bff).【F:docs/tech-stack.md†L120-L142】
