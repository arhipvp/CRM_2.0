# Gateway / BFF Service

## Назначение
Gateway — единая точка входа для веб-клиента и Telegram-бота. Он оркестрирует синхронные запросы, управляет сессиями, проксирует REST и SSE каналы к внутренним сервисам и маршрутизирует внешние вебхуки.【F:docs/architecture.md†L9-L66】【F:docs/tech-stack.md†L120-L142】

## Требования к окружению
- Node.js LTS (18+) и NestJS, менеджер пакетов pnpm/npm.【F:docs/tech-stack.md†L120-L138】
- Redis для хранения сессий и кеша, Consul для service discovery (по мере интеграции).【F:docs/tech-stack.md†L126-L136】
- Настроенные переменные `GATEWAY_SERVICE_PORT`, `GATEWAY_BASE_URL`, `REDIS_URL`, `CONSUL_HTTP_ADDR` и `GATEWAY_UPSTREAM_*` согласно [`env.example`](../../env.example).

## Локальный запуск
1. Установите зависимости: `corepack enable pnpm && pnpm install`.
2. Проверьте, что заданы `GATEWAY_SERVICE_PORT`, `GATEWAY_BASE_URL`, `REDIS_URL` и `CONSUL_HTTP_ADDR` (см. `env.example`).
3. Запустите сервис в режиме разработки с автоматической перезагрузкой:
   ```bash
   pnpm start:dev
   ```
4. Для проверки SSE проксирования убедитесь, что CRM и Notifications запущены локально либо используйте моки.

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
