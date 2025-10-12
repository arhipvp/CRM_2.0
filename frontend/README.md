# CRM 2.0 Frontend

Веб-клиент CRM построен на Next.js (App Router) с TypeScript, React Query и Zustand. Интерфейс поддерживает SSR, живые обновления через SSE и маршруты для воронки сделок, карточек клиентов/сделок, задач и платежей.

## Быстрый старт

```bash
pnpm install
pnpm dev
```

Приложение откроется на [http://localhost:3000](http://localhost:3000). Для корректной работы подключите REST Gateway и SSE-потоки в `.env` (см. раздел «Переменные окружения»).
Локальный запуск не требует настройки кастомных доменов: все публичные URL по умолчанию указывают на `http://localhost` и порт Gateway из `env.example`.

### Основные скрипты

| Скрипт            | Назначение                                        |
| ----------------- | ------------------------------------------------- |
| `pnpm dev`        | локальный сервер разработки Next.js               |
| `pnpm build`      | сборка production-бандла (standalone)             |
| `pnpm start`      | запуск собранного бандла                          |
| `pnpm lint`       | ESLint (включая проверки Storybook)               |
| `pnpm test`       | Vitest + React Testing Library с покрытием        |
| `pnpm test:watch` | Vitest в watch-режиме                             |
| `pnpm test:e2e`   | Playwright smoke-сценарии                         |
| `pnpm storybook`  | Storybook с UX-документацией                      |
| `pnpm storybook:build` | продакшн-сборка Storybook                   |
| `pnpm format`     | проверка стиля Prettier                           |

## Переменные окружения

Все публичные переменные объявлены в [`env.example`](../env.example):

- `NEXT_PUBLIC_API_BASE_URL` — REST API Gateway, который оборачивается клиентом `apiClient` (по умолчанию `http://localhost:${GATEWAY_SERVICE_PORT}/api`).
- `NEXT_PUBLIC_CRM_SSE_URL` — поток событий для статусов сделок/тасков.
- `NEXT_PUBLIC_PAYMENTS_SSE_URL` — поток событий платежей.
- `NEXT_PUBLIC_NOTIFICATIONS_SSE_URL` — поток уведомлений (toasts).

Все SSE-переменные должны указывать на публичные HTTPS/HTTP2 endpoints, возвращающие `text/event-stream`, поддерживающие CORS для фронтенда и не закрывающие соединение без причины. Клиент автоматически переподключается с экспоненциальной задержкой (до 30 секунд) и сбрасывает счётчик при успешном `onopen`. При ошибках со стороны сервера стоит убедиться, что Gateway проксирует заголовки `Cache-Control: no-transform` и heartbeat-сообщения.

В режиме разработки дефолтное значение `NEXT_PUBLIC_API_BASE_URL` указывает на Gateway, поднятый локально (`http://localhost:8080/api`), поэтому REST-запросы выполняются к реальному backend-слою. Чтобы вернуться к мок-данным из `src/mocks/data.ts`, переопределите URL на `mock` в `.env.local`.
- `NEXT_PUBLIC_PAYMENTS_SSE_URL` — поток финансовых событий (обновления платежей и балансов).
- `NEXT_PUBLIC_NOTIFICATIONS_SSE_URL` — поток уведомлений (toasts).

В режиме разработки дефолтное значение `NEXT_PUBLIC_API_BASE_URL` указывает на Gateway, поднятый локально (`http://localhost:${GATEWAY_SERVICE_PORT}/api`, то есть `http://localhost:8080/api` при стандартном порте), поэтому REST-запросы выполняются к реальному backend-слою. Чтобы вернуться к мок-данным из `src/mocks/data.ts`, переопределите URL на `mock` в `.env.local`.
В режиме разработки дефолтные значения `NEXT_PUBLIC_API_BASE_URL` и `NEXT_PUBLIC_*_SSE_URL` указывают на Gateway, поднятый локально (`http://localhost:8080/api`), поэтому REST-запросы выполняются к реальному backend-слою и не требуют локальных DNS-записей. Чтобы вернуться к мок-данным из `src/mocks/data.ts`, переопределите `NEXT_PUBLIC_API_BASE_URL` на `mock` в `.env.local`.

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

## Полезные ссылки

- Документация экранов и UX-сценариев: [`docs/frontend`](../docs/frontend).
- Настройка локального окружения: [`docs/local-setup.md`](../docs/local-setup.md#frontend).
