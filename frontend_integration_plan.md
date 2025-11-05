# План полной интеграции React Frontend в CRM_2.0

## Обзор
Интеграция React frontend (Vite + React 19) с микросервисной архитектурой CRM через Gateway, с полной аутентификацией, CRUD операциями для всех сущностей, Real-time обновлениями через SSE и контейнеризацией в Docker Compose.

## Блокеры и диагностика (2025-11-03)
- Критический блокер: dev-сервер Vite падает сразу после старта с ошибкой ReferenceError: process is not defined.
- Симптом: при запуске npm run dev приложение не монтируется, а в консоли браузера появляется сообщение о неизвестном идентификаторе process.
- Причина: модуль services/geminiService.ts выполняет process.env.VITE_GEMINI_API_KEY во время импорта. В браузере объекта process нет, а Vite 6 больше не подставляет shim, поэтому загрузка срывается ещё до инициализации React.
- План исправления: перенести чтение ключа в функцию и использовать только import.meta.env. Для тестов или утилит при необходимости пробрасывать значение через define в конфиге Vite.
- Контроль: после правки протестировать npm run dev, npm run build и smoke тестирование кнопок TTS, чтобы убедиться, что модуль больше не падает.
- API: в docker-compose фронтенд заполнял VITE_API_BASE_URL хостом gateway, из-за чего браузер получал ERR_NAME_NOT_RESOLVED. Меняем значение на относительный путь /api/v1, чтобы запросы шли через прокси Vite и резолвились снаружи.
- После обновления переменной окружения перезапустить контейнер: docker compose -f infra/docker-compose.yml up -d frontend.

---

## Этап 1: Инфраструктура и конфигурация (2-3 дня)

### 1.1 Docker интеграция
- [x] Создать/актуализировать `frontend/Dockerfile` (multi-stage build: dev + production)
- [x] Обновить сервис `frontend` в `infra/docker-compose.yml`
- [x] Настроить volumes для hot-reload в dev режиме
- [x] Добавить health check для frontend контейнера

### 1.2 Конфигурация окружения
- [x] Создать `frontend/.env.development` и `.env.production`
- [x] Настроить переменные: `VITE_API_BASE_URL`, `VITE_GATEWAY_URL`
- [x] Обновить `vite.config.ts` с proxy для `/api` → Gateway (8080)

### 1.3 CORS и Gateway
- [x] Настроить CORS в `backend/gateway/src/main.ts`:
  - origin: `http://localhost:3000` (dev), production URL
  - credentials: true
  - allowedHeaders: Authorization, Content-Type
- [x] Проверить преобразование snake_case ↔ camelCase в Gateway

### 1.4 Исправление проблемы загрузки скриптов
- [x] Исправить проблему с Dockerfile (COPY не находит package.json)
  - [x] Убедиться что build context правильный в docker-compose.yml
  - [x] Проверить что COPY пути корректны относительно build context
  - [x] Использовать абсолютные пути или правильные относительные пути в Dockerfile
- [x] Решить проблему с инициализацией PostCSS при первом старте
  - [x] npm install должен выполнять @tailwindcss/postcss установку правильно
  - [x] Проверить что все dependencies правильно указаны в package.json

---

## Этап 2: API клиент и типизация (2-3 дня)

### 2.1 HTTP клиент
- [x] Создать `frontend/services/apiClient.ts`:
  - [x] axios с baseURL из env
  - [x] Interceptors для JWT токенов
  - [x] Refresh token логика
  - [x] Обработка 401/403 с редиректом на login
  - [x] Централизованная обработка ошибок

### 2.2 Синхронизация типов
- [x] Обновить `frontend/types.ts` под backend схемы:
  - [x] Client, Deal, Policy, Payment, Quote, Task
  - [ ] Добавить типы для API responses: `ApiResponse<T>`, `PaginatedResponse<T>`
  - [ ] Типы для SSE событий

### 2.3 API методы
- [x] Создать `frontend/services/crmApi.ts`:
  - [x] **Clients**: `fetchClients()`, `createClient()`, `updateClient()`, `getClient(id)`
  - [x] **Deals**: `fetchDeals()`, `createDeal()`, `updateDeal()`, `getDeal(id)`
  - [x] **Policies**: базовые CRUD операции
  - [x] **Payments**: CRUD + доходы/расходы
  - [x] **Tasks**: получение/создание/обновление
- [ ] Добавить методы журнала сделок и котировок (после реализации на backend)

---

## Этап 3: Аутентификация (2-3 дня)

### 3.1 Auth контекст и сервисы
- Создать `frontend/contexts/AuthContext.tsx`:
  - State: `user`, `accessToken`, `isAuthenticated`, `loading`
  - Methods: `login()`, `logout()`, `refreshToken()`
  - Auto-refresh при истечении токена
- Создать `frontend/services/authApi.ts`:
  - `POST /api/v1/auth/token` (login)
  - `POST /api/v1/auth/refresh` (refresh token)
  - `POST /api/v1/auth/logout`

### 3.2 UI компоненты
- Создать `frontend/components/Login.tsx`:
  - Форма email/password
  - Валидация полей
  - Error handling (неверные credentials, connection errors)
  - "Запомнить меня" (localStorage vs sessionStorage)
- [x] Обновить `App.tsx`:
    - [x] Обернуть в `<AuthProvider>`
    - [x] Protected routes: редирект на `/login` если не авторизован
    - [x] Public routes: `/login`

### 3.3 Роли и права (опционально)
- Получать роли пользователя из Auth сервиса
- Создать `frontend/hooks/usePermissions.ts`
- Скрывать/показывать UI элементы в зависимости от роли

---

## Этап 4: Миграция от Mock к Real API (3-5 дней)

### 4.1 Рефакторинг состояния
- Удалить mock data генерацию из `geminiService.ts`
- Заменить `useState` на API calls в `App.tsx`:
  - Загрузка clients, deals, policies при монтировании
  - Loading states для каждой коллекции
  - Error states с retry кнопкой

### 4.2 CRUD операции по компонентам
  - **ClientsView.tsx**:
    - [x] `useEffect` → `crmApi.fetchClients()`
    - [x] Create/Edit формы → `crmApi.createClient()` / `updateClient()`
    - [ ] Оптимистичные обновления UI
- **DealsView.tsx**:
  - Аналогично для deals
  - Добавить загрузку journal entries
- **PoliciesView.tsx**:
    - [x] Полная миграция на API
- **PaymentsView.tsx**:
    - [x] Полная миграция на API
- **TasksView.tsx**:
    - [x] Перевести на `crmApi.fetchTasks()`, убрать зависимость от `deal.tasks`

### 4.3 Обработка ошибок
- Создать `frontend/components/ErrorBoundary.tsx`
- Toast уведомления для операций (success/error)
- Fallback UI для failed загрузок

---

## Этап 5: Real-time обновления (SSE) (2-3 дня)

### 5.1 SSE клиент
- Создать `frontend/services/sseClient.ts`:
  - EventSource для `/api/v1/streams/deals`
  - EventSource для `/api/v1/streams/notifications`
  - Поддержка Last-Event-ID для reconnect
  - Auto-reconnect при обрыве соединения

### 5.2 Интеграция с UI
- Создать `frontend/hooks/useSseEvents.ts`:
  - Слушать события: `deal.updated`, `payment.created`, `task.created`
  - Обновлять state автоматически
- Обновить компоненты:
  - При `deal.updated` → обновить список сделок
  - При `notification` → показать toast
  - Анимация для новых элементов

---

## Этап 6: Дополнительные функции (2-3 дня)

### 6.1 Управление файлами
- Интеграция с Documents API (8084):
  - Upload файлов к сделкам
  - Отображение списка файлов
  - Download через pre-signed URLs
- Drag & drop компонент для загрузки

### 6.2 Кэширование и оптимизация
- Установить **React Query** (или SWR):
  - Умное кэширование API запросов
  - Auto-refetch при фокусе окна
  - Optimistic updates
  - Devtools для отладки
- Debounce для поиска
- Виртуализация длинных списков (react-window)

### 6.3 UI/UX улучшения
- Скелетоны для loading states
- Infinite scroll или пагинация
- Сортировка и фильтрация на клиенте
- Breadcrumbs навигация

---

## Этап 7: Тестирование и документация (2-3 дня)

### 7.1 Тестирование
- Unit тесты для API клиента (Vitest)
- Integration тесты для критичных флоу (создание сделки)
- E2E тесты для основных сценариев (Playwright/Cypress)
- Тестирование авторизации и token refresh

### 7.2 Документация
- Обновить `.claude/frontend_integration_plan.md` с итоговым статусом
- Обновить `frontend/README.md`:
  - Инструкции по запуску
  - Environment variables
  - API endpoints
  - Troubleshooting
- Добавить frontend в корневой `README.md`

---

## Этап 8: Production готовность (1-2 дня)

### 8.1 Build конфигурация
- Оптимизация Vite build:
  - Code splitting
  - Tree shaking
  - Minification
  - Source maps для production
- Environment-specific configs

### 8.2 Deployment
- Production Dockerfile с Nginx
- Nginx конфигурация для SPA (fallback на index.html)
- Health check endpoint
- Logging и мониторинг

### 8.3 Безопасность
- Content Security Policy
- XSS защита
- CSRF токены (если нужно)
- Rate limiting на API

---

## Структура новых файлов

```
frontend/
├── .env.development          # Dev переменные
├── .env.production           # Prod переменные
├── Dockerfile               # Multi-stage build
├── nginx.conf               # Nginx для production
├── services/
│   ├── apiClient.ts         # HTTP клиент с JWT
│   ├── authApi.ts           # Auth endpoints
│   ├── crmApi.ts            # CRM endpoints
│   └── sseClient.ts         # SSE streams
├── contexts/
│   └── AuthContext.tsx      # Auth state management
├── hooks/
│   ├── useAuth.ts           # Auth хук
│   ├── useSseEvents.ts      # SSE хук
│   └── usePermissions.ts    # Роли и права
├── components/
│   ├── Login.tsx            # Login форма
│   ├── ErrorBoundary.tsx    # Error handling
│   └── ProtectedRoute.tsx   # Route guard
└── utils/
    ├── storage.ts           # localStorage helpers
    └── validators.ts        # Валидация форм
```

**Изменения в infra:**
```
infra/
├── docker-compose.yml       # + frontend сервис
└── .env                     # + FRONTEND_PORT=3000
```

**Изменения в backend:**
```
backend/gateway/
├── src/main.ts              # + CORS настройки
└── .env                     # + FRONTEND_URL
```

---

## Временные оценки

| Этап | Дни | Статус |
|------|-----|--------|
| 1. Инфраструктура | 2-3 | ✅ Завершена (Docker, Tailwind v4, PostCSS) |
| 2. API клиент | 2-3 | Разработка |
| 3. Аутентификация | 2-3 | ✅ Частично (Login компонент, AuthContext готовы) |
| 4. Миграция CRUD | 3-5 | Разработка |
| 5. SSE интеграция | 2-3 | Разработка |
| 6. Доп. функции | 2-3 | Полировка |
| 7. Тестирование | 2-3 | Проверка |
| 8. Production | 1-2 | Финализация |
| **ИТОГО** | **16-25 дней** | **~3-4 дней выполнено** |

---

## Критические зависимости

1. ✅ Backend API работает (CRM на 8082)
2. ✅ Gateway проксирует запросы (8080)
3. ✅ Auth сервис готов (8081)
4. ✅ Docker Compose инфраструктура
5. ⚠️ Нужно включить CORS в Gateway
6. ⚠️ Нужно настроить seed-данные для тестирования

---

## Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Несовместимость типов Backend/Frontend | Средняя | Gateway преобразует snake_case, тщательная типизация |
| Проблемы с CORS | Низкая | Настройка CORS на старте |
| SSE не работает через proxy | Средняя | Тестирование на раннем этапе |
| Token refresh конфликты | Средняя | Использовать проверенные паттерны |

---

## Следующие шаги после плана

1. Создать ветку `feature/frontend-integration`
2. Настроить Docker для frontend
3. Начать с API клиента и типизации
4. Поэтапно мигрировать компоненты
5. Тестировать на каждом этапе

---

## Проделанная работа (Ноябрь 2, 2025)

### ✅ Завершено в Этап 1:
1. **Docker многоэтапная сборка** - создан Dockerfile с builder, dev и production stages
2. **Tailwind v4 интеграция** - настроена PostCSS pipeline, удален CDN скрипт
3. **Frontend контейнеризация** - контейнер успешно запускается на порту 3000
4. **Исправлены HTML проблемы** - ClientList.tsx больше не имеет вложенных button элементов
5. **Improved Login UI** - современный дизайн с gradient background, улучшенная типография

### ✅ Завершено в Этап 3:
1. **AuthContext интеграция** - Login компонент использует useAuth() hook
2. **Protected routes** - App.tsx автоматически редиректит на login если не авторизован
3. **Error handling** - Обработка ошибок подключения, невалидных credentials, network errors

### ⚠️ Известные проблемы:
1. **Backend bootstrap error** - Auth сервис пытается обновить несуществующего пользователя (AdminBootstrapRunner.kt)
   - Сервис все равно работает и слушает на порту 8081
   - Требует исправления backend кода, не frontend
2. **PostgreSQL инициализация** - при полном рестарте (--volumes) роли не создаются автоматически
   - Решение: вручную создать роли через `docker compose exec postgres psql`
   - Предложение: обновить init.sh скрипт для более надежной инициализации

### 📝 Коммиты:
- `520310c` - Login form styling improvements
- Plus 4+ коммита для Tailwind/PostCSS интеграции





