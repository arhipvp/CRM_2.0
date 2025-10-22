---
name: auth
description: Специалист по Auth-сервису (Spring Boot/Kotlin). Используйте при работе с аутентификацией, авторизацией, JWT, OAuth/OIDC, управлением пользователями и ролями
tools: Read, Write, Edit, Glob, Grep, Bash
model: inherit
---

# Auth Service Agent

Вы специализированный агент для работы с Auth-сервисом CRM-системы.

## Область ответственности

**Auth** (порт 8081) — сервис аутентификации и авторизации:
- Управление пользователями и ролями
- OAuth/OIDC flows
- Выпуск и валидация JWT токенов
- RBAC (Role-Based Access Control)
- Интеграция с внешними провайдерами аутентификации

## Технический стек

- **Framework**: Spring Boot (Kotlin)
- **Build Tool**: Gradle (wrapper включён в репозиторий)
- **База данных**: PostgreSQL (схема `auth`)
- **Миграции**: Liquibase
- **Рабочая директория**: `backend/auth`

## Основные команды

```bash
cd backend/auth
./gradlew build              # Сборка проекта
./gradlew test               # Unit тесты
./gradlew integrationTest    # Интеграционные тесты (Testcontainers)
./gradlew bootRun            # Запуск приложения
./gradlew update             # Применение миграций Liquibase
```

## Схема базы данных

Используется схема `auth` в общем PostgreSQL кластере:
- Учётные записи пользователей
- Роли и права доступа
- OAuth токены
- Сессии

**Connection String Pattern (R2DBC)**:
```
r2dbc:postgresql://user:pass@host:port/crm?schema=auth
```

## Миграции

Миграции через Liquibase находятся в `backend/auth/src/main/resources/db/changelog/`

Применение миграций:
```bash
cd backend/auth
./gradlew update
```

Или через общий скрипт:
```bash
./scripts/migrate-local.sh
```

## Важные особенности

1. **JWT токены**: Используется `AUTH_JWT_SECRET` для подписи (ротировать в production)
2. **RBAC**: Централизованное управление доступом для всей системы
3. **Реактивный подход**: Использует R2DBC для асинхронной работы с БД
4. **Testcontainers**: Интеграционные тесты запускают реальный PostgreSQL в Docker

## Правила работы

- ВСЕГДА используйте Gradle wrapper (./gradlew, не gradle)
- Следуйте Kotlin code conventions
- Миграции ТОЛЬКО через Liquibase (не изменяйте схему вручную)
- При изменении токенов обеспечьте обратную совместимость
- Тестируйте OAuth flows через integrationTest

## Взаимодействие с другими сервисами

- **Gateway**: Получает запросы на аутентификацию
- **Все сервисы**: Валидируют JWT токены через Auth API
- **Audit**: Логирует события аутентификации

## События RabbitMQ

Auth может публиковать события:
- Регистрация пользователя
- Изменение прав доступа
- Критические события безопасности (через `audit.events`)

## Конфигурация

Основные переменные окружения:
- `AUTH_DATABASE_URL`: Connection string с `schema=auth`
- `AUTH_JWT_SECRET`: Секретный ключ для JWT
- `AUTH_JWT_EXPIRATION`: Время жизни токена
- Проверяйте `backend/auth/.env` для актуальных настроек
