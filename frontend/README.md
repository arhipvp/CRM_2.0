# Frontend (Next.js)

## Назначение
Фронтенд реализован на Next.js 14 и обеспечивает web-интерфейс CRM. Он обращается к Gateway по REST и SSE, отображает данные сделок, задач, платежей и интегрируется с Notifications для realtime-обновлений.【F:docs/tech-stack.md†L99-L118】【F:docs/frontend/README.md†L1-L40】

## Требования к окружению
- Node.js 20 LTS с включённым Corepack (для pnpm) и поддержкой React 18/Next.js 14.【F:docs/tech-stack.md†L99-L107】
- Переменные окружения `NEXT_PUBLIC_GATEWAY_BASE_URL`, `NEXT_PUBLIC_CRM_SSE_URL`, `NEXT_PUBLIC_NOTIFICATIONS_SSE_URL`, `NEXT_PUBLIC_TELEMETRY_DSN`, `FRONTEND_PROXY_TIMEOUT` и `NEXT_PUBLIC_FEATURE_FLAGS`, определённые в [`env.example`](../env.example).【F:docs/tech-stack.md†L111-L118】
- Для Storybook/Playwright тестов требуется Chromium (устанавливается через `pnpm dlx playwright install`).

## Локальный запуск
> **TODO:** развернуть фронтенд на Next.js 14 через `create-next-app` (pnpm), настроить поддержку SSR/CSR, Storybook и Playwright, описать копирование `env.example` → `.env.local`, базовые скрипты `dev`/`build`/`lint` и интеграцию с Gateway SSE.

## Сборка и запуск в Docker
> **TODO:** подготовить multi-stage Dockerfile Next.js, прописать скрипты `build`/`start` и параметры `FRONTEND_SERVICE_PORT`, добавить в `infra/docker-compose.yml` после генерации проекта.

## Полезные ссылки
- UX-документация и сценарии: [`docs/frontend/`](../docs/frontend/).【F:docs/frontend/README.md†L1-L40】
- Архитектурные связи и переменные окружения описаны в [`docs/tech-stack.md`](../docs/tech-stack.md#фронтенд).【F:docs/tech-stack.md†L99-L118】
