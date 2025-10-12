# CRM 2.0 Frontend

Веб-клиент CRM построен на Next.js (App Router) с TypeScript, React Query и Zustand. Интерфейс поддерживает SSR, живые обновления через SSE и маршруты для воронки сделок, карточек клиентов/сделок, задач и платежей.

## Быстрый старт

```bash
pnpm install
pnpm dev
```

Приложение откроется на [http://localhost:3000](http://localhost:3000). Для корректной работы подключите REST Gateway и SSE-потоки в `.env` (см. раздел «Переменные окружения»).

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

- `NEXT_PUBLIC_API_BASE_URL` — REST API Gateway, который оборачивается клиентом `apiClient`.
- `NEXT_PUBLIC_CRM_SSE_URL` — поток событий для статусов сделок/тасков.
- `NEXT_PUBLIC_NOTIFICATIONS_SSE_URL` — поток уведомлений (toasts).

В режиме разработки можно оставить значения по умолчанию — будут использованы мок-данные из `src/mocks/data.ts`.

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
