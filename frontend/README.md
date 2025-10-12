# CRM 2.0 Frontend

Веб-клиент CRM построен на Next.js (App Router) с TypeScript, React Query и Zustand. Интерфейс поддерживает SSR, живые обновления через SSE и маршруты для воронки сделок, карточек клиентов/сделок, задач и платежей.

## Быстрый старт

Перед установкой зависимостей убедитесь, что используется Node.js 20 LTS и активирован Corepack:

1. `corepack enable`
2. `corepack prepare pnpm@9 --activate`

```bash
pnpm install
pnpm dev
```

Приложение откроется на `http://localhost:${FRONTEND_SERVICE_PORT:-3000}`. Для корректной работы подключите REST Gateway и SSE-потоки в `.env` (см. раздел «Переменные окружения»). Быстрее всего синхронизировать файл через `../scripts/sync-env.sh frontend` — скрипт предупредит о перезаписи, после чего нужно обновить публичные токены и чувствительные значения.
Локальный запуск не требует настройки кастомных доменов: все публичные URL по умолчанию указывают на `http://localhost` и порт Gateway из `env.example`.

### Основные скрипты

| Скрипт            | Назначение                                        |
| ----------------- | ------------------------------------------------- |
| `pnpm dev`        | локальный сервер разработки Next.js (учитывает `FRONTEND_SERVICE_PORT`/`PORT`) |
| `pnpm build`      | сборка production-бандла (standalone)             |
| `pnpm start`      | запуск собранного бандла (учитывает `FRONTEND_SERVICE_PORT`/`PORT`) |
| `pnpm lint`       | ESLint (включая проверки Storybook)               |
| `pnpm test`       | Vitest + React Testing Library с покрытием        |
| `pnpm test:watch` | Vitest в watch-режиме                             |
| `pnpm test:e2e`   | Playwright smoke-сценарии                         |
| `pnpm storybook`  | Storybook с UX-документацией                      |
| `pnpm storybook:build` | продакшн-сборка Storybook                   |
| `pnpm format`     | проверка стиля Prettier                           |

## Переменные окружения

Все публичные переменные объявлены в [`env.example`](../env.example):

- `NEXT_PUBLIC_API_BASE_URL` — REST API Gateway, который оборачивается клиентом `apiClient` (по умолчанию `http://localhost:${GATEWAY_SERVICE_PORT}/api`). Укажите значение `mock`, чтобы отключить реальные запросы и всегда использовать встроенные мок-данные из `src/mocks`.
- `FRONTEND_PROXY_TIMEOUT` — таймаут (в миллисекундах) для Next.js middleware и клиента `apiClient`. Значение доступно и на сервере, и в браузере; дефолтный лимит 15 секунд защищает от зависших запросов.
- `NEXT_PUBLIC_CRM_SSE_URL` — поток событий для статусов сделок и задач (дефолт `http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/streams/deals`).
- `NEXT_PUBLIC_PAYMENTS_SSE_URL` — поток финансовых событий (дефолт `http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/streams/payments`), используется для обновления таблицы платежей и всплывающих уведомлений без ручного обновления страницы.
  - ⚠️ После включения upstream-конфигурации в Gateway (см. `GATEWAY_UPSTREAM_PAYMENTS_SSE_URL`) канал доступен по умолчанию; проверьте, что локальный Payments запущен, чтобы избежать авто-переподключений.
- `NEXT_PUBLIC_NOTIFICATIONS_SSE_URL` — поток уведомлений (toasts) (дефолт `http://localhost:${GATEWAY_SERVICE_PORT}/api/v1/streams/notifications`).

Все SSE-переменные должны указывать на публичные HTTPS/HTTP2 endpoints, возвращающие `text/event-stream`, поддерживающие CORS для фронтенда и не закрывающие соединение без причины. Клиент автоматически переподключается с экспоненциальной задержкой (до 30 секунд) и сбрасывает счётчик при успешном `onopen`. При ошибках со стороны сервера стоит убедиться, что Gateway проксирует заголовки `Cache-Control: no-transform` и heartbeat-сообщения.

В режиме разработки все указанные переменные по умолчанию указывают на локальный Gateway `http://localhost:${GATEWAY_SERVICE_PORT}`, поэтому REST-запросы (`/api`) и SSE-потоки (`/api/v1/streams/*`) идут к реальному backend-слою. Чтобы принудительно отключить обращения к сети и вернуться к мок-данным из `src/mocks/data.ts`, переопределите `NEXT_PUBLIC_API_BASE_URL` на `mock` в `.env.local` — клиент автоматически переключится в автономный режим.

## Архитектура UI

- `src/app` — маршруты App Router с SSR и гидрацией данных.
- `src/lib/api` — обёртка над REST API Gateway + описания React Query options.
- `src/stores` — Zustand-хранилища (фильтры воронки, уведомления).
- `src/components` — модульные UI-блоки (воронка, карточки, таблицы). Для ключевых компонентов есть Vitest-тесты и Storybook stories.
- `src/hooks/useEventStream.ts` и `src/components/providers/SSEBridge.tsx` — подключение к SSE с автореконнектом и записью в стор.

## Тестирование и качество

1. **Unit/RTL:** `pnpm test` — прогон Vitest с `jsdom` и coverage.
2. **E2E:** `pnpm exec playwright install --with-deps` (первый запуск), затем `pnpm test:e2e`.
3. **Storybook:** `pnpm storybook` открывает интерактивные сценарии, синхронизированные с `docs/frontend/*`.
4. **Линт/формат:** `pnpm lint` и `pnpm format` — обязательные проверки CI.

## Docker

Проект содержит мультистейдж Dockerfile (`frontend/Dockerfile`). Сборка образа:

```bash
pnpm install
pnpm build
docker build -f Dockerfile -t crm-frontend .
```

Контейнер запускает standalone-сборку Next.js (`node server.js` на порту 3000).

## Переопределение порта

- `pnpm dev` и `pnpm start` автоматически пробрасывают `PORT=${FRONTEND_SERVICE_PORT:-3000}`. Чтобы сменить порт, выполните `FRONTEND_SERVICE_PORT=3100 pnpm dev` или установите `PORT=3100` в окружении.
- E2E-тесты Playwright используют ту же переменную (`process.env.FRONTEND_SERVICE_PORT`), поэтому при изменении порта достаточно экспортировать её один раз перед запуском `pnpm test:e2e`.

## Полезные ссылки

- Документация экранов и UX-сценариев: [`docs/frontend`](../docs/frontend).
- Настройка локального окружения: [`docs/local-setup.md`](../docs/local-setup.md#frontend).

После обновления [`env.example`](../env.example) пересоздайте `.env.local`, чтобы локальная конфигурация соответствовала актуальным инструкциям.
