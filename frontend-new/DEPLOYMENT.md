# Frontend Deployment Guide

## Готовность к деплою

### Проверочный список

- [x] Dockerfile создан и настроен для production
- [x] .dockerignore настроен для исключения ненужных файлов
- [x] next.config.js настроен с `output: 'standalone'`
- [x] .env.production создан с production настройками
- [x] Структура приложения готова (app/, lib/)
- [x] package.json содержит все зависимости

### Необходимые файлы

#### 1. `.env.production` (СОЗДАН)
```env
# API Gateway URL
NEXT_PUBLIC_API_BASE_URL=http://gateway:8080/api/v1

# Auth configuration
NEXT_PUBLIC_AUTH_DISABLED=false
```

**Важно**: В docker-compose.yml переменные окружения переопределяются напрямую, поэтому этот файл используется только при локальной сборке.

#### 2. `Dockerfile` (ГОТОВ)
Файл уже настроен для production:
- Multi-stage build для оптимизации размера
- pnpm v9.0.0 через Corepack
- Standalone output для минимального runtime
- Node.js 20 Alpine (минимальный образ)
- Непривилегированный пользователь (nextjs:nodejs)

#### 3. `.dockerignore` (ГОТОВ)
Исключает из образа:
- node_modules (устанавливаются в контейнере)
- .next (собирается в контейнере)
- .git и документацию
- Локальные .env файлы

## Docker Compose интеграция

Frontend уже добавлен в `infra/docker-compose.yml` как сервис `frontend`:

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

## Деплой на сервер

### Вариант 1: Docker Compose (рекомендуется)

#### Запуск с backend профилем и новым фронтендом

```bash
# На сервере в директории проекта
cd /path/to/CRM_2.0

# Остановить старый фронтенд если запущен
docker-compose --profile app-legacy down frontend-old

# Запустить инфраструктуру + backend + новый фронтенд
docker-compose --profile backend --profile app up -d --build frontend

# Проверить логи
docker-compose logs -f frontend

# Проверить статус
docker-compose ps frontend
```

#### Запуск только нового фронтенда (если backend уже работает)

```bash
docker-compose --profile app up -d --build frontend
```

### Вариант 2: Standalone Docker (без compose)

```bash
# Сборка образа
cd frontend-new
docker build -t crm-frontend:latest .

# Запуск контейнера
docker run -d \
  --name crm-frontend \
  --network crm_infra \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_API_BASE_URL=http://gateway:8080/api/v1 \
  -e NEXT_PUBLIC_AUTH_DISABLED=false \
  --restart unless-stopped \
  crm-frontend:latest

# Проверка логов
docker logs -f crm-frontend
```

### Проверка работоспособности

```bash
# Проверка healthcheck (если будет добавлен)
curl http://localhost:3000/

# Проверка логов
docker-compose logs frontend

# Проверка сетевого подключения к Gateway
docker exec frontend curl -I http://gateway:8080/api/v1/health
```

## Обновление на production

### Минимальное время простоя

```bash
# 1. Собрать новый образ
docker-compose --profile app build frontend

# 2. Остановить старый контейнер и запустить новый
docker-compose --profile app up -d frontend

# 3. Проверить, что новый контейнер работает
docker-compose ps frontend
docker-compose logs --tail=50 frontend

# 4. Очистить старые образы
docker image prune -f
```

### Zero-downtime deployment (с nginx)

Если используется nginx как reverse proxy перед фронтендом:

```bash
# 1. Запустить новый фронтенд на другом порту
docker run -d \
  --name crm-frontend-new \
  --network crm_infra \
  -p 3001:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=http://gateway:8080/api/v1 \
  crm-frontend:latest

# 2. Переключить nginx на новый порт
# Отредактировать nginx.conf: proxy_pass http://localhost:3001

# 3. Перезагрузить nginx
nginx -s reload

# 4. Удалить старый контейнер
docker stop crm-frontend && docker rm crm-frontend

# 5. Переименовать новый
docker rename crm-frontend-new crm-frontend
```

## Переменные окружения

### Build-time переменные (встраиваются в код)

Все переменные с префиксом `NEXT_PUBLIC_*` встраиваются в клиентский JavaScript bundle при сборке.

**В docker-compose.yml:**
- `NEXT_PUBLIC_API_BASE_URL` - URL Gateway API
- `NEXT_PUBLIC_AUTH_DISABLED` - Флаг отключения аутентификации

### Runtime переменные

- `NODE_ENV` - production (устанавливается автоматически)
- `PORT` - порт приложения (3000 по умолчанию)
- `HOSTNAME` - 0.0.0.0 (слушать на всех интерфейсах)

## Troubleshooting

### Контейнер не запускается

```bash
# Проверить логи сборки
docker-compose --profile app build --no-cache frontend

# Проверить логи runtime
docker-compose logs frontend

# Проверить процессы внутри контейнера
docker exec frontend ps aux
```

### Не может подключиться к Gateway

```bash
# Проверить, что gateway в той же сети
docker network inspect crm_infra

# Проверить DNS резолюцию
docker exec frontend nslookup gateway

# Проверить доступность gateway
docker exec frontend wget -qO- http://gateway:8080/api/v1/health
```

### pnpm-lock.yaml отсутствует

```bash
# Локально выполнить установку зависимостей
cd frontend-new
pnpm install

# Закоммитить pnpm-lock.yaml
git add pnpm-lock.yaml
git commit -m "Add pnpm-lock.yaml for reproducible builds"

# Отправить на сервер и пересобрать
git push
docker-compose --profile app build --no-cache frontend
```

### Ошибка "Cannot find module"

Обычно связана с отсутствием зависимостей. Проверьте:
1. Все зависимости в package.json
2. pnpm install выполнен корректно
3. Не используется npm/yarn (только pnpm)

## Мониторинг

### Логи

```bash
# Все логи
docker-compose logs frontend

# Последние 100 строк с автообновлением
docker-compose logs -f --tail=100 frontend

# Логи с временными метками
docker-compose logs -t frontend
```

### Метрики контейнера

```bash
# CPU, память, сеть
docker stats frontend

# Детальная информация
docker inspect frontend
```

### Health checks (будет добавлено позже)

Рекомендуется добавить в docker-compose.yml:

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost:3000/ || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Откат к старому фронтенду

Если новый фронтенд работает некорректно:

```bash
# Остановить новый фронтенд
docker-compose --profile app down frontend

# Запустить старый фронтенд
docker-compose --profile app-legacy up -d frontend-old nginx

# Проверить
curl http://localhost:3000
```

## Чеклист для production

- [ ] pnpm-lock.yaml закоммичен в git
- [ ] .env.production проверен (правильный URL Gateway)
- [ ] Gateway доступен в Docker сети
- [ ] Порт 3000 не занят другим процессом
- [ ] Backend сервисы (gateway, auth, crm) запущены
- [ ] Nginx настроен (если используется)
- [ ] Мониторинг и логирование настроены
- [ ] SSL сертификаты установлены (если HTTPS)
- [ ] Firewall правила обновлены

## Следующие шаги

1. Добавить pnpm-lock.yaml (выполнить `pnpm install` локально)
2. Протестировать сборку локально: `docker build -t test-frontend .`
3. Загрузить файлы на сервер
4. Запустить через docker-compose с профилем `app`
5. Настроить мониторинг и алерты
