# Auth Service

## Назначение
Auth — сервис управления пользователями и ролями. Он отвечает за OAuth/OIDC-потоки, выдачу токенов и проверку доступа других компонентов системы, опираясь на схему PostgreSQL `auth` и Redis для хранения refresh-токенов.【F:docs/architecture.md†L9-L18】【F:docs/tech-stack.md†L144-L170】

## Требования к окружению
- JDK 17, Gradle 8 (используется встроенный wrapper `./gradlew`).
- PostgreSQL 15+ c доступом к схеме `auth` и расширению Liquibase.
- Redis 6+ для хранения refresh-токенов.
- Переменные окружения из корневого [`env.example`](../../env.example) (секция `Auth`).

### Ключевые переменные окружения
| Переменная | Назначение |
| --- | --- |
| `AUTH_SERVICE_PORT` | HTTP-порт сервиса (по умолчанию `8081`). |
| `AUTH_DATABASE_URL` | R2DBC URI PostgreSQL, например `r2dbc:postgresql://auth:auth@localhost:5432/auth`. |
| `AUTH_REDIS_URL` | URI Redis, например `redis://localhost:6379/0`. |
| `AUTH_JWT_SECRET` | Секрет подписи JWT (HS256). |
| `AUTH_JWT_ISSUER` / `AUTH_JWT_AUDIENCE` | Метаданные токена для потребителей. |
| `AUTH_ACCESS_TOKEN_TTL` / `AUTH_REFRESH_TOKEN_TTL` | Время жизни access/refresh токенов (ISO-8601 `Duration`). |

## Локальный запуск
```bash
cd backend/auth
./gradlew bootRun
```
Перед стартом убедитесь, что PostgreSQL и Redis доступны и применены миграции (см. ниже). Application context автоматически прогоняет Liquibase и формирует базовые роли `ROLE_USER`/`ROLE_ADMIN`.

### Основные эндпоинты
- `POST /api/auth/register` — регистрация пользователя (роль `ROLE_USER`).
- `POST /api/auth/token` — выдача пары access/refresh токенов по email+паролю.
- `POST /api/auth/refresh` — обновление access токена по refresh токену.
- `GET /api/auth/me` — данные текущего пользователя (по access токену).
- `POST /api/roles`, `GET /api/roles` — управление ролями (только `ROLE_ADMIN`).
- `POST /api/users/{id}/roles`, `DELETE /api/users/{id}/roles/{role}` — назначение и отзыв ролей (только `ROLE_ADMIN`).

## Миграции
Миграции Liquibase расположены в [`migrations/db/changelog`](migrations/db/changelog) и автоматически подключены через Spring Boot. Для запуска вручную:
```bash
./gradlew update
```
Первый набор (`0001-init-auth-tables`) создаёт таблицы `users`, `roles`, `user_roles` и заполняет базовые роли.

## Тесты
Для проверки используется JUnit 5 + Testcontainers (PostgreSQL, Redis):
```bash
./gradlew test
```
Тесты поднимают реальные контейнеры, прогоняют миграции и проверяют работу репозиториев и REST-API выдачи токенов.

## Docker
```bash
./gradlew bootBuildImage --imageName=crm-auth:local
```
Далее:
```bash
docker run --rm -p ${AUTH_SERVICE_PORT:-8081}:8081 --env-file ../../env.example crm-auth:local
```
Настоятельно рекомендуется использовать собственный `.env` вместо шаблона для локальной разработки.

## Дополнительные ссылки
- [Архитектурный обзор](../../docs/architecture.md)
- [Технологический стек Auth](../../docs/tech-stack.md#auth)
- [Общая настройка окружения](../../docs/local-setup.md)
