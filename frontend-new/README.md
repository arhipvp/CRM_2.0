# CRM Frontend

Минимальный Next.js 15 фронтенд для CRM системы.

## Технологии

- **Next.js 15** (App Router)
- **React 18**
- **TypeScript**
- **pnpm v9** (package manager)

## Быстрый старт

### 1. Установка зависимостей

```bash
pnpm install
```

### 2. Настройка окружения

Создайте файл `.env.local` на основе `.env.example`:

```bash
cp .env.example .env.local
```

Или создайте `.env.local` вручную:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_AUTH_DISABLED=true
```

### 3. Запуск dev сервера

```bash
pnpm dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

### 4. Production сборка

```bash
pnpm build
pnpm start
```

## Структура проекта

```
frontend-new/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Корневой layout
│   ├── page.tsx           # Главная страница (редирект на /login)
│   ├── login/
│   │   └── page.tsx       # Страница входа
│   └── dashboard/
│       └── page.tsx       # Dashboard после логина
├── lib/
│   └── api.ts             # API клиент для Gateway
├── package.json
├── tsconfig.json
├── next.config.js
├── .env.example
└── README.md
```

## Основные команды

```bash
pnpm dev          # Запуск dev сервера (порт 3000)
pnpm build        # Production сборка
pnpm start        # Запуск production сервера
pnpm lint         # ESLint проверка
pnpm type-check   # TypeScript проверка
```

## Страницы

### `/` (Главная)
- Автоматический редирект на `/login`

### `/login` (Вход)
- Форма входа с полями email/password
- При `NEXT_PUBLIC_AUTH_DISABLED=true` использует mock данные
- После успешного входа редирект на `/dashboard`

### `/dashboard` (Дашборд)
- Главная страница после авторизации
- Отображает приветствие и статистику (карточки)
- Кнопка выхода

## API Integration

Приложение работает с Gateway API через `lib/api.ts`:

- **Login**: `POST /api/v1/auth/login`
- **Logout**: `POST /api/v1/auth/logout`
- **Current User**: `GET /api/v1/auth/me`
- **Health Check**: `GET /api/v1/health`

### Mock режим

При `NEXT_PUBLIC_AUTH_DISABLED=true`:
- Логин работает с любыми credentials
- Не отправляются реальные запросы к API
- Токен и пользователь сохраняются в localStorage

## Environment Variables

| Переменная | Описание | Пример |
|------------|----------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | URL Gateway API | `http://localhost:8080/api/v1` |
| `NEXT_PUBLIC_AUTH_DISABLED` | Mock режим авторизации | `true` или `false` |

**ВАЖНО**: Все переменные с префиксом `NEXT_PUBLIC_*` встраиваются в bundle на этапе сборки!

## Стили

Используются inline стили (CSS-in-JS) для простоты и минимализма.

- Адаптивный дизайн
- Нативные HTML элементы (без UI библиотек)
- Простая цветовая схема

## Авторизация

Приложение использует localStorage для хранения:
- `authToken` - JWT токен (или mock)
- `user` - Данные пользователя (JSON)

При переходе на `/dashboard` проверяется наличие токена. Если токен отсутствует, происходит редирект на `/login`.

## Разработка

### Добавление новых страниц

1. Создайте директорию в `app/` с именем роута
2. Добавьте `page.tsx` файл
3. Используйте `'use client'` если нужен client-side код

Пример:
```tsx
// app/clients/page.tsx
'use client'

export default function ClientsPage() {
  return <div>Clients Page</div>
}
```

### Добавление API методов

Добавьте новые функции в `lib/api.ts`:

```typescript
export async function getClients(): Promise<ApiResponse<Client[]>> {
  return apiFetch('/clients')
}
```

## Troubleshooting

### Порт 3000 занят

Измените порт при запуске:
```bash
PORT=3001 pnpm dev
```

### API не отвечает

1. Проверьте что Gateway запущен: `curl http://localhost:8080/health`
2. Проверьте `NEXT_PUBLIC_API_BASE_URL` в `.env.local`
3. Откройте Network tab в браузере для отладки

### Hydration errors

Если видите ошибки hydration:
1. Проверьте что не используете `localStorage` в Server Components
2. Используйте `'use client'` для клиентских компонентов
3. Используйте `suppressHydrationWarning` для динамических данных

## Production Deployment

### Docker

```bash
# Build image
docker build -t crm-frontend .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=http://your-gateway/api/v1 \
  crm-frontend
```

### Standalone build

Next.js создает standalone build для оптимизации:

```bash
pnpm build
# Результат в .next/standalone/
```

## License

Proprietary
