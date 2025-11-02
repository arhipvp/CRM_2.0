# План полной интеграции React Frontend в CRM_2.0

## Обзор
Интеграция React frontend (Vite + React 19) с микросервисной архитектурой CRM через Gateway, с полной аутентификацией, CRUD операциями для всех сущностей, Real-time обновлениями через SSE и контейнеризацией в Docker Compose.

---

## Этап 1: Инфраструктура и конфигурация (2-3 дня)

### 1.1 Docker интеграция
- Создать `frontend/Dockerfile` (multi-stage build: dev + production)
- Добавить сервис `frontend` в `infra/docker-compose.yml`
- Настроить volumes для hot-reload в dev режиме
- Добавить health check для frontend контейнера

### 1.2 Конфигурация окружения
- Создать `frontend/.env.development` и `.env.production`
- Настроить переменные: `VITE_API_BASE_URL`, `VITE_GATEWAY_URL`
- Обновить `vite.config.ts` с proxy для `/api` → Gateway (8080)

### 1.3 CORS и Gateway
- Настроить CORS в `backend/gateway/src/main.ts`:
  - origin: `http://localhost:3000` (dev), production URL
  - credentials: true
  - allowedHeaders: Authorization, Content-Type
- Проверить преобразование snake_case ↔ camelCase в Gateway

---

## Этап 2: API клиент и типизация (2-3 дня)

### 2.1 HTTP клиент
- Создать `frontend/services/apiClient.ts`:
  - axios с baseURL из env
  - Interceptors для JWT токенов
  - Refresh token логика
  - Обработка 401/403 с редиректом на login
  - Централизованная обработка ошибок

### 2.2 Синхронизация типов
- Обновить `frontend/types.ts` под backend схемы:
  - Client, Deal, Policy, Payment, Quote, Task
  - Привести к camelCase (Gateway преобразует)
  - Добавить типы для API responses: `ApiResponse<T>`, `PaginatedResponse<T>`
  - Типы для SSE событий

### 2.3 API методы
- Создать `frontend/services/crmApi.ts`:
  - **Clients**: `fetchClients()`, `createClient()`, `updateClient()`, `getClient(id)`
  - **Deals**: `fetchDeals()`, `createDeal()`, `updateDeal()`, `getDeal(id)`, `getDealJournal(id)`, `addJournalEntry()`
  - **Policies**: `fetchPolicies()`, `createPolicy()`, `updatePolicy()`
  - **Payments**: `fetchPayments()`, `createPayment()`, `updatePayment()`, `deletePayment()`
  - **Quotes**: `fetchQuotes()`, `createQuote()`
  - **Tasks**: `fetchTasks()`, `createTask()`, `updateTask()`

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
- Обновить `App.tsx`:
  - Обернуть в `<AuthProvider>`
  - Protected routes: редирект на `/login` если не авторизован
  - Public routes: `/login`

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
  - `useEffect` → `crmApi.fetchClients()`
  - Create/Edit формы → `crmApi.createClient()` / `updateClient()`
  - Оптимистичные обновления UI
- **DealsView.tsx**:
  - Аналогично для deals
  - Добавить загрузку journal entries
- **PoliciesView.tsx**, **PaymentsView.tsx**, **TasksView.tsx**:
  - Полная миграция на API

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
| 1. Инфраструктура | 2-3 | Подготовка |
| 2. API клиент | 2-3 | Разработка |
| 3. Аутентификация | 2-3 | Разработка |
| 4. Миграция CRUD | 3-5 | Разработка |
| 5. SSE интеграция | 2-3 | Разработка |
| 6. Доп. функции | 2-3 | Полировка |
| 7. Тестирование | 2-3 | Проверка |
| 8. Production | 1-2 | Финализация |
| **ИТОГО** | **16-25 дней** | |

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
