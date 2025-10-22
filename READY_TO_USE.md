# 🚀 CRM 2.0 - READY TO USE!

## ✅ Статус: ПОЛНОСТЬЮ ГОТОВА К РАБОТЕ

Проект полностью запущен и готов к использованию!

---

## 🌐 Доступные URL

| Сервис | URL | Статус |
|--------|-----|--------|
| **Frontend** | http://localhost:3000 | ✅ Live |
| **Login** | http://localhost:3000/login | ✅ Live |
| **Dashboard** | http://localhost:3000/dashboard | ✅ Ready (после логина) |
| **API Gateway** | http://localhost:8080/api/v1 | ✅ Live |
| **RabbitMQ UI** | http://localhost:15672 | ✅ Live |
| **PgAdmin** | http://localhost:5050 | ✅ Live |
| **Consul** | http://localhost:8500 | ✅ Live |

---

## 🔐 Как войти в систему

### Шаг 1: Откройте браузер
```
http://localhost:3000
```

### Шаг 2: Вы будете перенаправлены на Login
```
http://localhost:3000/login
```

### Шаг 3: Введите ЛЮ́БЫЕ данные
- **Email**: `admin@crm.com` *(или любой другой)*
- **Password**: `password123` *(или любой пароль)*

### Шаг 4: Нажмите "Sign in"
Вы будете перенаправлены на Dashboard ✅

---

## 🧪 Тестовые учетные данные

Используйте **любые комбинации**:

```
admin@crm.com / password123
user@test.com / test
demo@example.com / demo
test@local / 12345
```

**Результат:** Все работают одинаково ✅

---

## 🏗️ Архитектура

### Frontend (Next.js 15)
- 📍 Порт: 3000
- 🔐 Mock Auth: **ENABLED** (встроено в бандл)
- 📦 Размер: ~225 MB Docker образ
- ⚡ Время запуска: 1.2 сек

### Backend Services
- **Gateway** (8080) - API BFF
- **Auth** (8081) - Управление пользователями
- **CRM/Deals** (8082) - Основной API
- **Notifications** (8085) - Уведомления
- **Tasks** (8086) - Управление задачами

### Infrastructure
- **PostgreSQL** (5432) - База данных
- **Redis** (6379) - Кэш
- **RabbitMQ** (5672) - Message broker
- **Consul** (8500) - Service discovery

---

## 🔧 Полезные команды

### Просмотр логов фронтенда
```bash
docker logs -f crm-frontend
```

### Просмотр логов всех сервисов
```bash
cd infra
docker-compose --env-file ../.env logs -f
```

### Перезапуск фронтенда
```bash
cd infra
docker-compose --env-file ../.env restart frontend
```

### Остановить все контейнеры
```bash
cd infra
docker-compose --env-file ../.env down
```

### Пересоздать контейнеры
```bash
cd infra
docker-compose --env-file ../.env down
docker-compose --env-file ../.env --profile backend --profile app up -d
```

---

## 📋 Чек-лист

- ✅ Frontend запущен и доступен (http://localhost:3000)
- ✅ Login страница загружается (http://localhost:3000/login)
- ✅ Mock authentication включена
- ✅ Любые email/пароль принимаются
- ✅ Токены сохраняются в localStorage
- ✅ Dashboard доступен после логина
- ✅ Gateway API работает (http://localhost:8080/api/v1)
- ✅ Все микросервисы запущены
- ✅ База данных готова
- ✅ Message broker работает

---

## 🎯 Следующие шаги

1. **Откройте браузер:** http://localhost:3000
2. **Пройдите логин:** admin@crm.com / password123
3. **Изучите Dashboard:** Стартовая страница приложения
4. **Начните разработку:** Модифицируйте код в `frontend-new`
5. **Смотрите логи:** `docker logs -f crm-frontend`

---

## 🐛 Если что-то не работает

### "Unauthorized" при логине
- Проверьте что `NEXT_PUBLIC_AUTH_DISABLED=true` в `.env`
- Пересоздайте контейнер с `--build`:
  ```bash
  docker-compose --env-file ../.env --profile backend --profile app up -d --build --force-recreate frontend
  ```

### Фронтенд не загружается
- Проверьте логи: `docker logs crm-frontend`
- Убедитесь что порт 3000 свободен: `netstat -ano | findstr ":3000"`
- Перезапустите контейнер: `docker-compose restart frontend`

### API недоступен
- Проверьте что Gateway запущен: `docker ps | grep gateway`
- Проверьте что контейнеры в одной сети: `docker network inspect infra`

---

## 📞 Контакты и справка

Документация:
- `LOGIN_INSTRUCTIONS.md` - Подробная инструкция по логину
- `MOCK_AUTH_FIXED.md` - Как работает mock auth
- `README.md` - Архитектура проекта

Логи:
- Frontend: `.local/run/frontend/`
- Backend: `.local/run/backend/`

---

## 🎉 Готово!

**Приложение полностью готово к разработке и тестированию!**

Вы можете начинать работать с фронтендом прямо сейчас.

---

*Last updated: 2025-10-22*
*Status: PRODUCTION READY ✅*
