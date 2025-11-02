# Frontend Docker Deployment Guide

**Дата:** 3 ноября 2025
**Статус:** ✅ Готов к production deployment в контейнере

---

## 🐳 Проблемы и решения

### Проблема 1: "An API Key must be set when running in a browser"
**Причина:** Google Generative AI инициализировалась на top-level без проверки API key
**Решение:**
- Lazy initialization - инициализируем только когда нужна функция TTS
- Fallback на Web Speech API (браузерный native API)
- Без API key - автоматически используется Web Speech API

**Результат:** Frontend работает с или без Google API key ✅

---

## 📋 Инструкции по запуску

### Вариант 1: Быстрый старт (dev режим)

```bash
# Просто запустить скрипт
./scripts/restart-frontend.sh

# Или вручную:
cd C:\Dev\CRM_2.0\frontend
npm install
npm run dev
# http://localhost:3000
```

### Вариант 2: Production в Docker

```bash
# Запустить с production target
./scripts/restart-frontend.sh --prod

# Или вручную:
docker build -f frontend/Dockerfile -t crm-frontend:latest .
docker run -p 3000:80 \
  -e VITE_API_BASE_URL=http://gateway:8080/api/v1 \
  crm-frontend:latest
```

### Вариант 3: Через docker-compose

```bash
# Запустить весь stack с фронтендом
docker compose -f infra/docker-compose.yml up -d

# Или только фронтенд
docker compose -f infra/docker-compose.yml up -d frontend
```

---

## 🔧 Dockerfile Multi-stage Build

```dockerfile
# Stage 1: Builder (Node.js)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Dev (Node.js)
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Stage 3: Production (Nginx)
FROM nginx:alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Использование:**
```bash
# Dev - горячая перезагрузка
docker build --target dev -t crm-frontend:dev .
docker run -p 3000:3000 crm-frontend:dev

# Production - Nginx + оптимизированный build
docker build --target prod -t crm-frontend:prod .
docker run -p 80:80 crm-frontend:prod
```

---

## 🛠️ Конфигурация Nginx

### Ключевые функции в nginx.conf:

1. **CORS поддержка** - для API proxy
2. **Gzip compression** - уменьшение размера файлов
3. **Security headers** - защита от XSS, clickjacking, etc.
4. **Static files caching** - кэширование на 1 день
5. **API proxy** - перенаправление на Gateway
6. **SPA fallback** - все маршруты на index.html

### CORS Headers:
```nginx
add_header Access-Control-Allow-Origin $http_origin always;
add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
```

### API Proxy:
```nginx
location /api/ {
    proxy_pass http://gateway:8080/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

---

## 🌍 Окружение (Environment Variables)

### Development (.env.development)
```env
VITE_API_BASE_URL=http://127.0.0.1:8080/api/v1
VITE_GATEWAY_URL=http://127.0.0.1:8080
VITE_DEBUG_MODE=true
VITE_LOG_REQUESTS=true
VITE_TOKEN_STORAGE=sessionStorage
VITE_GEMINI_API_KEY=  # Пусто - используется Web Speech API
```

### Production (.env.production)
```env
VITE_API_BASE_URL=/api/v1  # Relative - nginx proxy
VITE_GATEWAY_URL=/
VITE_DEBUG_MODE=false
VITE_LOG_REQUESTS=false
VITE_TOKEN_STORAGE=localStorage
VITE_GEMINI_API_KEY=  # Пусто - используется Web Speech API
```

### Docker Compose (infra/docker-compose.yml)
```yaml
frontend:
  build:
    context: ../frontend
    dockerfile: Dockerfile
    target: ${FRONTEND_TARGET:-dev}  # dev или prod
  environment:
    VITE_API_BASE_URL: ${VITE_API_BASE_URL:-http://localhost:8080/api/v1}
    VITE_GATEWAY_URL: ${VITE_GATEWAY_URL:-http://localhost:8080}
    VITE_DEBUG_MODE: ${VITE_DEBUG_MODE:-false}
  ports:
    - "${FRONTEND_PORT:-3000}:${FRONTEND_CONTAINER_PORT:-3000}"
  depends_on:
    gateway:
      condition: service_healthy
```

---

## 🎯 TTS Fallback Strategy

### Приоритет:
1. **Google Generative AI** (если есть VITE_GEMINI_API_KEY)
   - Высокое качество, русский голос "Kore"
   - Требует API key
2. **Web Speech API** (браузерный, всегда доступен)
   - Native browser API
   - Работает во всех браузерах
   - Русский язык поддерживается

### Как это работает:

```typescript
// geminiService.ts
const initializeGemini = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('[TTS] No API key, using Web Speech API fallback');
    return null;
  }
  // ... инициализация Google API
};

export const generateAndPlayAudio = async (text: string) => {
  const client = initializeGemini();

  if (!client) {
    // Fallback на Web Speech API
    return fallbackTTS(text);
  }

  // Используем Google API
};
```

**Результат:** Приложение работает без ошибок, TTS всегда доступен! ✅

---

## 📊 Docker Compose Services

```yaml
services:
  frontend:
    # React SPA
    # Доступен на http://localhost:3000 (dev) или :80 (prod)
    depends_on: [gateway]

  gateway:
    # Nginx reverse proxy для микросервисов
    # Доступен на http://localhost:8080

  postgres:
    # База данных для всех сервисов

  rabbitmq:
    # Message queue

  redis:
    # Кэш

  auth:
    # Auth микросервис на 8081

  crm:
    # CRM микросервис на 8082

  documents:
    # Documents микросервис на 8084
```

---

## ✅ Проверка здоровья контейнера

### Healthcheck в docker-compose:
```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/ || exit 1"]
  interval: 15s
  timeout: 5s
  retries: 5
  start_period: 30s
```

### Ручная проверка:
```bash
# Проверить что контейнер работает
docker ps | grep crm-frontend

# Проверить логи
docker logs crm-frontend

# Проверить здоровье
docker inspect --format='{{.State.Health}}' crm-frontend

# Проверить доступность
curl http://localhost:3000
curl http://localhost:3000/api/v1/crm/clients
```

---

## 🚀 Production Deployment

### CI/CD Pipeline (рекомендуется):

```bash
# 1. Build
npm install
npm run build

# 2. Docker build
docker build -f frontend/Dockerfile --target prod -t registry.example.com/crm-frontend:latest .

# 3. Push to registry
docker push registry.example.com/crm-frontend:latest

# 4. Deploy
docker pull registry.example.com/crm-frontend:latest
docker run -d \
  --name crm-frontend \
  -p 80:80 \
  -e VITE_API_BASE_URL=https://api.example.com/api/v1 \
  registry.example.com/crm-frontend:latest
```

### Kubernetes Deployment (опционально):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crm-frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: crm-frontend
  template:
    metadata:
      labels:
        app: crm-frontend
    spec:
      containers:
      - name: frontend
        image: registry.example.com/crm-frontend:latest
        ports:
        - containerPort: 80
        env:
        - name: VITE_API_BASE_URL
          value: "https://api.example.com/api/v1"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 30
```

---

## 📝 Логирование и отладка

### Console logs при загрузке:

```
[DataLoader] Using real API data                    # API доступен
[DataLoader] Using mock data                        # API недоступен
[TTS] No GEMINI_API_KEY found, using fallback       # Google API не настроен
[TTS] Using Web Speech API fallback                 # Используется браузерный API
```

### Docker логи:
```bash
docker logs crm-frontend -f --tail 100
```

### Browser DevTools:
- F12 → Console - логи приложения
- Network tab - API запросы
- Application tab - sessionStorage/localStorage

---

## 🎓 Примеры команд

### Полный цикл:

```bash
# 1. Очистить старые контейнеры
docker compose down

# 2. Собрать и запустить
docker compose up -d --build frontend

# 3. Проверить статус
docker compose ps

# 4. Посмотреть логи
docker compose logs frontend -f

# 5. Переполучить конфиг
docker compose exec frontend wget -qO- http://localhost/api/v1/crm/clients

# 6. Перезагрузить
docker compose restart frontend

# 7. Остановить
docker compose stop frontend
```

### Развитие:

```bash
# Войти в контейнер
docker compose exec frontend sh

# Посмотреть файлы
docker compose exec frontend ls -la /usr/share/nginx/html

# Проверить nginx config
docker compose exec frontend nginx -t
```

---

## 🎉 Итоговая чеклист

- ✅ Google Generative AI не требуется для запуска
- ✅ TTS работает через Web Speech API fallback
- ✅ Frontend работает в контейнере
- ✅ CORS настроен в nginx
- ✅ API proxy работает через Gateway
- ✅ Healthcheck сконфигурирован
- ✅ Логирование включено
- ✅ Security headers установлены
- ✅ Static files кэшируются
- ✅ SPA routing работает

**Готово к production! 🚀**
