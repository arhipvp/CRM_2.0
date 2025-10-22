# Файлы для деплоя нового фронтенда

## Статус готовности: ✅ ГОТОВО к деплою

Все необходимые файлы созданы и настроены.

## Критические файлы (обязательные)

### 1. Dockerfile
**Путь**: `C:/Dev/CRM_2.0/frontend-new/Dockerfile`
**Статус**: ✅ Готов
**Описание**: Multi-stage production build с pnpm 9.0.0, Node.js 20 Alpine, standalone output

### 2. package.json
**Путь**: `C:/Dev/CRM_2.0/frontend-new/package.json`
**Статус**: ✅ Готов
**Описание**: Зависимости проекта (Next.js 15, React 18)

### 3. next.config.js
**Путь**: `C:/Dev/CRM_2.0/frontend-new/next.config.js`
**Статус**: ✅ Готов
**Описание**: Конфигурация с `output: 'standalone'` для Docker

### 4. .dockerignore
**Путь**: `C:/Dev/CRM_2.0/frontend-new/.dockerignore`
**Статус**: ✅ Готов
**Описание**: Исключает node_modules, .next, .git из образа

### 5. .env.production
**Путь**: `C:/Dev/CRM_2.0/frontend-new/.env.production`
**Статус**: ✅ Создан
**Содержание**:
```env
# API Gateway URL
NEXT_PUBLIC_API_BASE_URL=http://gateway:8080/api/v1

# Auth configuration
NEXT_PUBLIC_AUTH_DISABLED=false
```

### 6. tsconfig.json
**Путь**: `C:/Dev/CRM_2.0/frontend-new/tsconfig.json`
**Статус**: ✅ Готов
**Описание**: TypeScript конфигурация

### 7. .eslintrc.json
**Путь**: `C:/Dev/CRM_2.0/frontend-new/.eslintrc.json`
**Статус**: ✅ Готов
**Описание**: ESLint правила

## Директории приложения

### 8. app/
**Путь**: `C:/Dev/CRM_2.0/frontend-new/app/`
**Статус**: ✅ Готова
**Содержимое**:
- `app/layout.tsx` - Корневой layout
- `app/page.tsx` - Главная страница (редирект на /login)
- `app/login/page.tsx` - Страница логина
- `app/dashboard/page.tsx` - Dashboard (защищен авторизацией)

### 9. lib/
**Путь**: `C:/Dev/CRM_2.0/frontend-new/lib/`
**Статус**: ✅ Готова
**Содержимое**:
- `lib/api.ts` - API клиент для работы с Gateway

### 10. public/
**Путь**: `C:/Dev/CRM_2.0/frontend-new/public/`
**Статус**: ✅ Создана
**Описание**: Статические ресурсы (пока пустая)

## Документация

### 11. DEPLOYMENT.md
**Путь**: `C:/Dev/CRM_2.0/frontend-new/DEPLOYMENT.md`
**Статус**: ✅ Создан
**Описание**: Полное руководство по деплою (10 KB)

### 12. DEPLOY-QUICKSTART.md
**Путь**: `C:/Dev/CRM_2.0/frontend-new/DEPLOY-QUICKSTART.md`
**Статус**: ✅ Создан
**Описание**: Краткая инструкция для быстрого деплоя

### 13. README.md
**Путь**: `C:/Dev/CRM_2.0/frontend-new/README.md`
**Статус**: ✅ Готов
**Описание**: Общая информация о проекте

## ВАЖНО: Отсутствующие файлы

### ⚠️ pnpm-lock.yaml
**Путь**: `C:/Dev/CRM_2.0/frontend-new/pnpm-lock.yaml`
**Статус**: ❌ ОТСУТСТВУЕТ
**Действие**: ОБЯЗАТЕЛЬНО создать перед деплоем

**Команды для создания**:
```bash
cd C:/Dev/CRM_2.0/frontend-new
pnpm install
git add pnpm-lock.yaml
git commit -m "Add pnpm-lock.yaml for reproducible builds"
```

**Почему это важно**:
- Dockerfile ожидает наличие pnpm-lock.yaml
- Без него сборка Docker образа будет падать
- Обеспечивает воспроизводимость установки зависимостей

## Docker Compose интеграция

### 14. infra/docker-compose.yml
**Путь**: `C:/Dev/CRM_2.0/infra/docker-compose.yml`
**Статус**: ✅ Уже настроен
**Секция**: Сервис `frontend` (строки 531-549)

```yaml
frontend:
  build:
    context: ../frontend-new
    dockerfile: Dockerfile
  container_name: frontend
  restart: unless-stopped
  environment:
    NODE_ENV: production
    PORT: 3000
    NEXT_PUBLIC_API_BASE_URL: http://gateway:8080/api/v1
    NEXT_PUBLIC_AUTH_DISABLED: ${AUTH_DISABLED:-false}
  ports:
    - "${FRONTEND_SERVICE_PORT:-3000}:3000"
  depends_on:
    gateway:
      condition: service_healthy
  networks:
    - infra
  profiles: ["app"]
```

## Чеклист перед деплоем

### На локальной машине:
- [ ] Создать pnpm-lock.yaml: `cd frontend-new && pnpm install`
- [ ] Закоммитить все изменения: `git add . && git commit -m "..."`
- [ ] Отправить на сервер: `git push`

### На сервере:
- [ ] Получить изменения: `git pull`
- [ ] Убедиться что Gateway запущен: `docker-compose ps gateway`
- [ ] Запустить фронтенд: `docker-compose --profile app up -d --build frontend`
- [ ] Проверить логи: `docker-compose logs -f frontend`
- [ ] Проверить доступность: `curl http://localhost:3000`

## Структура файлов для загрузки

Если загружаете файлы вручную (не через git):

```
frontend-new/
├── .dockerignore
├── .env.production
├── .eslintrc.json
├── Dockerfile
├── next.config.js
├── package.json
├── pnpm-lock.yaml        ← СОЗДАТЬ ПЕРЕД ЗАГРУЗКОЙ!
├── tsconfig.json
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── login/
│   │   └── page.tsx
│   └── dashboard/
│       └── page.tsx
├── lib/
│   └── api.ts
└── public/
    └── .gitkeep
```

**Размер**: ~50 KB (без node_modules и .next)

## Команды для деплоя

### Вариант 1: Через Docker Compose (рекомендуется)
```bash
cd /path/to/CRM_2.0
docker-compose --profile app up -d --build frontend
```

### Вариант 2: Standalone Docker
```bash
cd frontend-new
docker build -t crm-frontend:latest .
docker run -d --name crm-frontend \
  --network crm_infra \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=http://gateway:8080/api/v1 \
  crm-frontend:latest
```

## Порты и сетевые зависимости

- **Внешний порт**: 3000 (настраивается через `FRONTEND_SERVICE_PORT`)
- **Docker сеть**: `infra`
- **Зависимости**:
  - Gateway должен быть доступен по `http://gateway:8080`
  - Backend сервисы должны быть запущены (profile: backend)

## Переменные окружения

### Build-time (встраиваются в код):
- `NEXT_PUBLIC_API_BASE_URL` - URL Gateway API
- `NEXT_PUBLIC_AUTH_DISABLED` - Флаг отключения авторизации

### Runtime:
- `NODE_ENV=production` - режим production
- `PORT=3000` - порт приложения
- `HOSTNAME=0.0.0.0` - слушать на всех интерфейсах

## Размер образа (примерно)

- **Multi-stage build**: ~150-200 MB
- **Runtime слой**: ~100 MB (Alpine + Node.js + standalone app)
- **Dependencies**: ~50 MB

## Troubleshooting

См. подробную документацию в:
- `DEPLOYMENT.md` - полное руководство
- `DEPLOY-QUICKSTART.md` - быстрый старт

## Контакты и поддержка

Если возникли проблемы, проверьте:
1. Логи: `docker-compose logs frontend`
2. Healthcheck Gateway: `docker-compose ps gateway`
3. Доступность Gateway из контейнера: `docker exec frontend wget -qO- http://gateway:8080/api/v1/health`
