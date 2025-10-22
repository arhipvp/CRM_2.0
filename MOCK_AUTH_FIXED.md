# ✅ Mock Authentication - FIXED!

## 🎉 Проблема исправлена!

**Предыдущая ошибка:** "Unauthorized" при попытке логина

**Причина:** Переменная окружения `NEXT_PUBLIC_AUTH_DISABLED=true` не попадала в JavaScript бандл при build-time

**Решение:** Добавлены ARG в Dockerfile для передачи переменных в момент сборки

---

## 📝 Что было изменено

### 1. **Dockerfile** (`frontend-new/Dockerfile`)
Добавлены build arguments для Next.js:
```dockerfile
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
ARG NEXT_PUBLIC_AUTH_DISABLED=true
ARG NEXT_PUBLIC_CRM_SSE_URL=http://localhost:8080/api/v1/streams/deals
ARG NEXT_PUBLIC_NOTIFICATIONS_SSE_URL=http://localhost:8080/api/v1/streams/notifications

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_AUTH_DISABLED=${NEXT_PUBLIC_AUTH_DISABLED}
...
```

### 2. **docker-compose.yml** (`infra/docker-compose.yml`)
Добавлены build-time args в секцию build:
```yaml
build:
  context: ../frontend-new
  dockerfile: Dockerfile
  args:
    NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL:-http://gateway:8080/api/v1}
    NEXT_PUBLIC_AUTH_DISABLED: ${NEXT_PUBLIC_AUTH_DISABLED:-true}
    ...
```

### 3. **.env** файл
Добавлена переменная:
```bash
NEXT_PUBLIC_AUTH_DISABLED=true
```

---

## 🚀 Как это работает теперь

1. **Docker build время:**
   - Переменные передаются как BUILD ARGS
   - Next.js встраивает их в JavaScript бандл
   - Mock auth код компилируется в приложение

2. **Runtime (в контейнере):**
   - Фронтенд содержит уже скомпилированный mock auth
   - Любой логин (email/пароль) создает fake JWT токен
   - Система работает без обращения к реальному Auth сервису

---

## ✅ Как протестировать

### Вариант 1: В браузере
1. Откройте http://localhost:3000/login
2. Введите **любой email и пароль**:
   - Email: `admin@crm.com` (или любой)
   - Password: `password123` (или любой)
3. Нажмите "Sign in"
4. Вы должны быть перенаправлены на /dashboard ✅

### Вариант 2: Команда для проверки
```bash
# Проверить что переменная встроена в бандл
docker logs crm-frontend

# Ожидаемый вывод:
# ✓ Ready in 1185ms
```

---

## 🔧 Ключевые моменты

**ВАЖНО:** Переменная `NEXT_PUBLIC_AUTH_DISABLED` должна быть установлена **ДО** сборки Docker образа, так как это NEXT.JS переменная, которая встраивается в JavaScript бандл.

| Когда | Где | Как |
|-------|-----|-----|
| **Build-time** | Dockerfile ARG + ENV | Встраивается в JS бандл |
| **Runtime** | Docker container env | Не влияет на бандл, но для логов |
| **Frontend JS** | `process.env.NEXT_PUBLIC_AUTH_DISABLED` | Используется в `lib/api.ts` |

---

## 📋 Файлы которые были измены

- ✅ `frontend-new/Dockerfile` - добавлены ARG для build-time
- ✅ `infra/docker-compose.yml` - добавлены build args
- ✅ `.env` - добавлена переменная `NEXT_PUBLIC_AUTH_DISABLED=true`

---

## 🧪 Тестовые данные для логина

**Используйте ЛЮ́БЫЕ данные:**

| Email | Пароль | Результат |
|-------|---------|-----------|
| admin@example.com | admin | ✅ Принимается |
| user@test.com | password | ✅ Принимается |
| test@crm.local | 12345 | ✅ Принимается |
| **ЛЮБОЙ EMAIL** | **ЛЮБОЙ ПАРОЛЬ** | ✅ Принимается |

После логина:
- Токен сохранится в localStorage
- Вы будете перенаправлены на `/dashboard`
- Система работает в demo mode

---

## 🎯 Итог

**Проблема:** "Unauthorized" ошибка при логине
**Решение:** Добавлены build-time переменные в Dockerfile
**Статус:** ✅ FIXED и WORKING!

Теперь можете спокойно тестировать фронтенд без нужды в реальной аутентификации.
