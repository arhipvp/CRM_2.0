# CRM Insurance Broker - Frontend (React 19 + Vite)

Современный React фронтенд для микросервисной архитектуры CRM системы. Использует Vite для быстрой разработки и Tailwind CSS v4 для стилизации.

## Особенности

- **Real API интеграция** - работает через Gateway с JWT аутентификацией
- **React 19 + TypeScript** - полная типизация с синхронизацией backend моделей
- **Tailwind CSS v4** - современный дизайн с PostCSS pipeline
- **Protected Routes** - аутентификация и авторизация
- **Optimized Build** - multi-stage Docker контейнеризация
- **Hot Module Reload** - instant обновления во время разработки

## Структура проекта

```
frontend/
├── components/          # React компоненты (views, forms, layouts)
├── contexts/           # React Context (auth, state management)
├── services/           # API клиент и бизнес-логика
├── utils/              # Вспомогательные функции
├── types.ts            # TypeScript типы синхронизированные с backend
├── App.tsx             # Главный компонент с роутингом
├── index.tsx           # Entry point
└── vite.config.ts      # Vite конфигурация
```

## Быстрый старт

### Требования
- Node.js 18+ (LTS рекомендуется)
- npm или yarn
- Работающий backend (Gateway на 8080, Auth на 8081, CRM на 8082)

### Установка и запуск

1. **Установить зависимости:**
   ```bash
   cd frontend
   npm install
   ```

2. **Запустить dev сервер:**
   ```bash
   npm run dev
   ```
   Приложение откроется на `http://localhost:3000`

3. **Production build:**
   ```bash
   npm run build
   ```

## Конфигурация

Все переменные окружения находятся в `.env.development` (dev) и `.env.production` (prod):

```env
# Gateway API (через которую проходят все запросы)
VITE_API_BASE_URL=http://127.0.0.1:8080/api/v1

# Feature flags и настройки
VITE_DEBUG_MODE=true
VITE_LOG_REQUESTS=true
VITE_API_TIMEOUT=30000
VITE_TOKEN_STORAGE=sessionStorage
```

## API Интеграция

Frontend использует следующие API endpoints через Gateway:

### Clients
- `GET /api/v1/crm/clients` - список клиентов
- `GET /api/v1/crm/clients/{id}` - клиент по ID
- `POST /api/v1/crm/clients` - создание клиента
- `PATCH /api/v1/crm/clients/{id}` - обновление клиента

### Deals
- `GET /api/v1/crm/deals` - список сделок
- `GET /api/v1/crm/deals/{id}` - сделка по ID
- `POST /api/v1/crm/deals` - создание сделки
- `PATCH /api/v1/crm/deals/{id}` - обновление сделки

### Policies
- `GET /api/v1/crm/policies` - список полисов
- `POST /api/v1/crm/policies` - создание полиса
- `PATCH /api/v1/crm/policies/{id}` - обновление полиса

### Payments
- `GET /api/v1/crm/deals/{dealId}/policies/{policyId}/payments` - платежи
- `POST /api/v1/crm/deals/{dealId}/policies/{policyId}/payments` - создание платежа

## Аутентификация

Frontend использует JWT для аутентификации:

1. **Login** - отправка email/password на `/api/v1/auth/token`
2. **Token Storage** - токены хранятся в sessionStorage
3. **Auto Refresh** - при истечении accessToken автоматически обновляется через refreshToken
4. **Protected Routes** - неавторизованные пользователи редиректятся на `/login`

## Docker

Frontend поставляется в Docker контейнере с multi-stage build:

### Build
```bash
docker build -f frontend/Dockerfile -t crm-frontend:latest .
```

### Run
```bash
docker run -p 3000:3000 crm-frontend:latest
```

Контейнер включает:
- **Stage 1 (builder)**: установка зависимостей и сборка
- **Stage 2 (production)**: Nginx с оптимизированными настройками

### Docker Compose

Для локальной разработки через `infra/docker-compose.yml` добавлен именованный volume `frontend_node_modules:/app/node_modules`. Он сохраняет зависимости контейнера и предотвращает перезапись `node_modules` при монтировании каталога `../frontend:/app`. Убедитесь, что volume указан в секции `services.frontend.volumes`, а также объявлен в корневом блоке `volumes`:

```yaml
services:
  frontend:
    volumes:
      - ../frontend:/app
      - frontend_node_modules:/app/node_modules

volumes:
  frontend_node_modules: {}
```

Docker Compose создаёт volume автоматически при запуске `docker compose -f infra/docker-compose.yml up frontend --build`.

## Типизация

Frontend полностью типизирован и синхронизирован с backend:

- `types.ts` содержит все модели (Client, Deal, Policy, Payment, Task, Quote и т.д.)
- API методы в `services/crmApi.ts` имеют правильные типы параметров и возвращаемых значений
- Gateway автоматически преобразует snake_case ↔ camelCase

## Development Guide

### Добавление нового API метода

```typescript
// В services/crmApi.ts:
export async function fetchNewEntity(query?: QueryParams): Promise<NewEntity[]> {
  try {
    const response = await apiClient.get<NewEntity[]>(`/crm/new-entities`, { params: query });
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch new entities:', error);
    throw error;
  }
}
```

### Обработка ошибок

Все API запросы автоматически:
- Добавляют JWT токен в headers
- Обновляют токен при 401 ошибке
- Логируют ошибки в консоль
- Пробрасывают ошибки для обработки в компонентах

## Статус

**Версия**: 0.0.1
**Статус**: 🚧 Development (Этап 2-3 завершен)

### Завершено (Этап 2-3)
- ✅ API клиент с JWT
- ✅ Аутентификация и Protected Routes
- ✅ Real API интеграция
- ✅ TypeScript типизация
- ✅ Docker контейнеризация
- ✅ Tailwind CSS v4

### В разработке (Этап 4-5)
- 🔄 CRUD операции с error handling
- 🔄 SSE real-time обновления
- 🔄 Loading и error states
- 🔄 Toast notifications

### Планируется (Этап 6-8)
- ⏳ React Query кэширование
- ⏳ Виртуализация списков
- ⏳ E2E тесты
- ⏳ Production optimization
