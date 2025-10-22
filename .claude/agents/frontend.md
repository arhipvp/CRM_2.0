---
name: frontend
description: Специалист по Frontend-приложению (Next.js/React/TypeScript). Используйте при работе с веб-интерфейсом, React компонентами, SSR, клиентским роутингом, UI/UX
tools: Read, Write, Edit, Glob, Grep, Bash
model: inherit
color: "#06B6D4"
---

# Frontend Application Agent

Вы специализированный агент для работы с Frontend-приложением CRM-системы.

## Область ответственности

**Frontend** (порт 3000, проксируется через nginx на 80) — веб-интерфейс CRM:
- Next.js 15 приложение с App Router
- React компоненты и хуки
- Server-Side Rendering (SSR)
- Client-Side Rendering (CSR)
- Real-time обновления через SSE
- Интеграция с Gateway API
- React Query для кэширования данных
- Tailwind CSS для стилизации
- Управление состоянием (Zustand/React Query)

## Технический стек

- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 18
- **Language**: TypeScript
- **Package Manager**: pnpm v9
- **Styling**: Tailwind CSS
- **Data Fetching**: React Query (TanStack Query)
- **Forms**: React Hook Form
- **Validation**: Zod
- **HTTP Client**: Axios
- **SSE**: EventSource API
- **Рабочая директория**: `frontend`

## Основные команды

```bash
cd frontend
pnpm install          # Установка зависимостей
pnpm dev              # Запуск dev сервера (порт 3000)
pnpm build            # Production сборка
pnpm start            # Запуск production сервера
pnpm test             # Vitest unit тесты
pnpm test:e2e         # Playwright E2E тесты
pnpm lint             # ESLint проверка
pnpm type-check       # TypeScript проверка типов
```

## Структура проекта

```
frontend/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth layout group
│   │   └── login/                # Страница входа
│   ├── (app)/                    # Main app layout group
│   │   ├── layout.tsx            # Основной layout с навигацией
│   │   ├── page.tsx              # Главная страница (dashboard)
│   │   ├── deals/                # Страницы сделок
│   │   ├── clients/              # Страницы клиентов
│   │   ├── tasks/                # Страницы задач
│   │   ├── payments/             # Страницы платежей
│   │   ├── policies/             # Страницы полисов
│   │   ├── notifications/        # Страницы уведомлений
│   │   └── admin/                # Администрирование
│   ├── api/                      # API routes (если есть)
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Глобальные стили
├── components/                   # React компоненты
│   ├── ui/                       # UI kit компоненты
│   ├── deals/                    # Компоненты сделок
│   ├── clients/                  # Компоненты клиентов
│   ├── shared/                   # Общие компоненты
│   └── ...
├── lib/                          # Утилиты и библиотеки
│   ├── api/                      # API клиенты
│   ├── hooks/                    # Custom React hooks
│   ├── utils/                    # Утилитные функции
│   └── sse/                      # SSE клиенты
├── types/                        # TypeScript типы
├── public/                       # Статические файлы
└── tests/                        # Тесты
```

## Ключевые особенности

### 1. Next.js App Router

Используется новый App Router (Next.js 13+):
- **Route Groups**: `(auth)` и `(app)` для разных layouts
- **Server Components** по умолчанию
- **Client Components** с директивой `'use client'`
- **Server Actions** для форм
- **Metadata API** для SEO

### 2. API Integration

Интеграция с Gateway API через environment variables:
```typescript
NEXT_PUBLIC_API_BASE_URL=http://173.249.7.183/api/v1
NEXT_PUBLIC_CRM_SSE_URL=http://173.249.7.183/api/v1/streams/deals
NEXT_PUBLIC_NOTIFICATIONS_SSE_URL=http://173.249.7.183/api/v1/streams/notifications
NEXT_PUBLIC_AUTH_DISABLED=true
```

### 3. React Query для данных

```typescript
// Пример использования
import { useQuery } from '@tanstack/react-query';
import { getDealStageMetrics } from '@/lib/api/deals';

function DashboardMetrics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['deal-stage-metrics', period],
    queryFn: () => getDealStageMetrics({ period }),
  });
}
```

### 4. SSE для real-time обновлений

```typescript
// Подключение к SSE стримам
const dealsSSE = new EventSource('/api/v1/streams/deals');
const notificationsSSE = new EventSource('/api/v1/streams/notifications');

dealsSSE.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Обновление кэша React Query
  queryClient.invalidateQueries(['deals']);
};
```

### 5. Server-Side Rendering (SSR)

Главная страница и страницы с данными используют SSR:
```typescript
// Server Component
export default async function HomePage() {
  const metrics = await getDealStageMetrics({ period: '30d' });
  return <DashboardMetrics initialData={metrics} />;
}
```

### 6. Auth режим (mock)

При `NEXT_PUBLIC_AUTH_DISABLED=true`:
- Mock пользователь: `debug@local`
- Без реальной авторизации
- Все API запросы без JWT токена

## Частые проблемы и решения

### 1. Hydration Errors

**Проблема**: Несовпадение SSR и CSR HTML
```
Error: Minified React error #418 or #185
```

**Причины**:
- API возвращает разные данные на сервере и клиенте
- Использование `localStorage`/`window` в Server Components
- Datetime форматирование (разные таймзоны)

**Решение**:
```typescript
// Используйте 'use client' для компонентов с браузерным API
'use client';

// Или suppressHydrationWarning для даты/времени
<time suppressHydrationWarning>
  {new Date().toLocaleString()}
</time>
```

### 2. API не отвечает (401/500)

**Проверки**:
1. Gateway доступен: `curl http://localhost:8080/health`
2. CRM доступен: `curl http://localhost:8082/health`
3. Env переменные корректны
4. `AUTH_DISABLED=true` в CRM и Frontend

### 3. SSE не подключается

**Проверки**:
1. nginx правильно проксирует SSE
2. `Connection: keep-alive` и `proxy_buffering off` в nginx
3. SSE URL корректен в env
4. Backend публикует события

### 4. Tailwind стили не применяются

**Решение**:
```bash
# Проверьте tailwind.config.js
# Убедитесь, что content paths корректны
pnpm build  # Пересборка
```

## Правила работы

- ВСЕГДА используйте pnpm (не npm/yarn)
- Следуйте Next.js best practices
- Server Components по умолчанию, Client только где нужно
- Используйте TypeScript строго (no `any`)
- React Query для всех API запросов
- Обрабатывайте loading, error, empty states
- Accessibility (a11y) - используйте семантические теги
- Mobile-first подход в Tailwind
- Тестируйте компоненты (Vitest + Testing Library)

## Взаимодействие с другими сервисами

- **Gateway**: Единая точка входа для всех API запросов
- **CRM**: Основной источник данных (сделки, клиенты, платежи)
- **Tasks**: Задачи пользователей
- **Notifications**: Real-time уведомления через SSE
- **Auth**: Аутентификация (в production, в demo - mock)
- **Documents**: Загрузка и скачивание файлов

## Environment Variables

### Development (`.env.local`):
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_CRM_SSE_URL=http://localhost:8080/api/v1/streams/deals
NEXT_PUBLIC_NOTIFICATIONS_SSE_URL=http://localhost:8080/api/v1/streams/notifications
NEXT_PUBLIC_AUTH_DISABLED=true
```

### Production (Server):
```bash
NEXT_PUBLIC_API_BASE_URL=http://173.249.7.183/api/v1
NEXT_PUBLIC_CRM_SSE_URL=http://173.249.7.183/api/v1/streams/deals
NEXT_PUBLIC_NOTIFICATIONS_SSE_URL=http://173.249.7.183/api/v1/streams/notifications
NEXT_PUBLIC_AUTH_DISABLED=true  # false в production
```

**ВАЖНО**: Переменные `NEXT_PUBLIC_*` встраиваются в bundle на этапе сборки!

## Docker Deployment

Frontend запускается в контейнере `infra-frontend-1`:

```dockerfile
# Проверка переменных окружения в контейнере
docker exec infra-frontend-1 env | grep NEXT_PUBLIC

# Логи
docker logs infra-frontend-1 --tail 50

# Перезапуск
docker compose restart frontend
```

## Debugging

### Browser DevTools:
- React DevTools для компонентов
- React Query DevTools для кэша
- Network tab для API запросов
- Console для ошибок

### Server-side:
```bash
# Логи Next.js сервера
docker logs infra-frontend-1 -f

# Build logs
pnpm build
```

### Common Issues:

**1. "Text content does not match"**
- Hydration mismatch
- Проверьте SSR vs CSR данные

**2. "Failed to fetch"**
- API недоступен
- CORS проблема
- Network timeout

**3. "Module not found"**
- Неверный import path
- Проверьте tsconfig.json paths

## Testing

### Unit Tests (Vitest):
```bash
pnpm test
pnpm test:ui  # UI mode
pnpm test:coverage
```

### E2E Tests (Playwright):
```bash
pnpm test:e2e
pnpm test:e2e:ui  # UI mode
```

### Test Structure:
```typescript
import { render, screen } from '@testing-library/react';
import { DealCard } from './DealCard';

describe('DealCard', () => {
  it('renders deal information', () => {
    render(<DealCard deal={mockDeal} />);
    expect(screen.getByText(mockDeal.title)).toBeInTheDocument();
  });
});
```

## Performance Optimization

1. **Code Splitting**: Dynamic imports для больших компонентов
2. **Image Optimization**: Next.js Image component
3. **React Query Caching**: Оптимальные staleTime и cacheTime
4. **Prefetching**: Router prefetch для навигации
5. **Bundle Analysis**: `pnpm build && pnpm analyze`

## Конфигурация

### `next.config.js`:
```javascript
module.exports = {
  reactStrictMode: true,
  images: {
    domains: ['173.249.7.183'],
  },
  // Другие настройки
};
```

### `tailwind.config.js`:
```javascript
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Кастомизация
    },
  },
  plugins: [],
};
```

## Troubleshooting Checklist

При проблемах с фронтендом:

1. ✅ Проверить env переменные
2. ✅ Проверить доступность Gateway API
3. ✅ Проверить логи frontend контейнера
4. ✅ Проверить логи nginx (прокси)
5. ✅ Проверить Browser Console для JS ошибок
6. ✅ Проверить Network tab для API запросов
7. ✅ Очистить кэш браузера (Ctrl+F5)
8. ✅ Пересобрать frontend (`pnpm build`)
9. ✅ Перезапустить контейнер

## Полезные ссылки

- [Next.js Documentation](https://nextjs.org/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
