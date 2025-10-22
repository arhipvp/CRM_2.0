# Быстрый старт деплоя

## 1. Подготовка (ВЫПОЛНЕНО)

Все необходимые файлы готовы:
- ✅ `Dockerfile` - production ready
- ✅ `.dockerignore` - настроен
- ✅ `.env.production` - создан с production настройками
- ✅ `next.config.js` - standalone output
- ✅ Интеграция в `infra/docker-compose.yml`

## 2. Что нужно сделать перед деплоем

### На локальной машине:

```bash
# Создать pnpm-lock.yaml (ОБЯЗАТЕЛЬНО!)
cd frontend-new
pnpm install

# Закоммитить изменения
git add .
git commit -m "Add production config for frontend-new"
git push
```

## 3. Деплой на сервер

### Команды на сервере:

```bash
# Перейти в директорию проекта
cd /path/to/CRM_2.0

# Получить последние изменения
git pull

# Запустить новый фронтенд
docker-compose --profile app up -d --build frontend

# Проверить статус
docker-compose ps frontend
docker-compose logs -f frontend
```

## 4. Проверка

```bash
# Открыть в браузере
http://your-server:3000

# Или через curl
curl -I http://localhost:3000
```

## 5. Если что-то пошло не так

```bash
# Посмотреть логи
docker-compose logs frontend

# Пересобрать без кеша
docker-compose --profile app build --no-cache frontend
docker-compose --profile app up -d frontend

# Откатиться к старому фронтенду
docker-compose --profile app down frontend
docker-compose --profile app-legacy up -d frontend-old
```

## Важно!

1. **pnpm-lock.yaml** - ОБЯЗАТЕЛЬНО должен быть создан и закоммичен
2. Gateway должен быть запущен и доступен (profile: backend)
3. Порт 3000 не должен быть занят

## Архитектура

```
Browser → http://server:3000
          ↓
       Frontend Container (Next.js)
          ↓
       http://gateway:8080/api/v1
          ↓
       Gateway Container
          ↓
       Backend Services (CRM, Auth, etc.)
```

Frontend подключается к Gateway по внутренней Docker сети через hostname `gateway`.
