# Frontend (Next.js)

## Назначение
Фронтенд реализован на Next.js 14 и обеспечивает web-интерфейс CRM. Он обращается к Gateway по REST и SSE, отображает данные сделок, задач, платежей и интегрируется с Notifications для realtime-обновлений.【F:docs/tech-stack.md†L99-L118】【F:docs/frontend/README.md†L1-L40】

## Требования к окружению
- Node.js 20 LTS с включённым Corepack (для pnpm) и поддержкой React 18/Next.js 14.【F:docs/tech-stack.md†L99-L107】
- Переменные окружения `NEXT_PUBLIC_GATEWAY_BASE_URL`, `NEXT_PUBLIC_CRM_SSE_URL`, `NEXT_PUBLIC_NOTIFICATIONS_SSE_URL`, `NEXT_PUBLIC_TELEMETRY_DSN`, `FRONTEND_PROXY_TIMEOUT` и `NEXT_PUBLIC_FEATURE_FLAGS`, определённые в [`env.example`](../env.example).【F:docs/tech-stack.md†L111-L118】
- Для Storybook/Playwright тестов требуется Chromium (устанавливается через `pnpm dlx playwright install`).

## Локальный запуск
1. Включите Corepack и установите зависимости:
   ```bash
   corepack enable
   pnpm install
   ```
2. Скопируйте `env.example` в `frontend/.env.local`, заполните значения Gateway и SSE (для потоков по умолчанию используйте маршруты `https://gateway.local/api/v1/streams/deals` и `https://gateway.local/api/v1/streams/notifications`).
3. Запустите режим разработки:
   ```bash
   pnpm dev
   ```
   Приложение стартует на `http://localhost:${FRONTEND_SERVICE_PORT:-3000}` (порт настраивается переменной).
4. Для прогонки тестов используйте:
   ```bash
   pnpm test           # unit/компонентные тесты (Vitest)
   pnpm test:e2e       # end-to-end (Playwright)
   pnpm lint           # ESLint/TypeScript проверки
   ```

## Сборка и запуск в Docker
1. Соберите production-сборку:
   ```bash
   pnpm build
   pnpm start
   ```
2. Для контейнера используйте стандартный multi-stage Dockerfile Next.js и команды:
   ```bash
   docker build -t crm-frontend:local -f docker/Dockerfile.frontend .
   docker run --rm -p ${FRONTEND_SERVICE_PORT:-3000}:3000 --env-file ../env.example crm-frontend:local
   ```

## Полезные ссылки
- UX-документация и сценарии: [`docs/frontend/`](../docs/frontend/).【F:docs/frontend/README.md†L1-L40】
- Архитектурные связи и переменные окружения описаны в [`docs/tech-stack.md`](../docs/tech-stack.md#фронтенд).【F:docs/tech-stack.md†L99-L118】
