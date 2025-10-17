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
| `AUTH_DATABASE_URL` | R2DBC URI PostgreSQL, например `r2dbc:postgresql://auth:auth@localhost:5432/crm?schema=auth`. |
| `AUTH_REDIS_URL` | URI Redis, например `redis://localhost:6379/0`. |
| `AUTH_JWT_SECRET` | Секрет подписи JWT (HS256). |
| `AUTH_JWT_ISSUER` | Значение `iss` в токенах. Должно совпадать с базовым URL Auth (`AUTH_BASE_URL`), например `http://localhost:${AUTH_SERVICE_PORT}`. |
| `AUTH_JWT_AUDIENCE` | Значение `aud` для клиентов (Gateway, фронтенд и т.д.). |
| `AUTH_ACCESS_TOKEN_TTL` | Время жизни access-токена (ISO-8601 `Duration`, например `PT15M`). Значение обрезается по краям; пустая строка приводит к использованию дефолта `PT15M`. |
| `AUTH_REFRESH_TOKEN_TTL` | Время жизни refresh-токена (ISO-8601 `Duration`, например `P7D`). Значение обрезается по краям; пустая строка приводит к использованию дефолта `P7D`. |

> ℹ️ Шаблон `.env` в корне репозитория использует префикс `r2dbc:` и параметр `schema=auth` (или `search_path=auth`) в `AUTH_DATABASE_URL`. При обновлении локального `.env` скопируйте свежий пример и убедитесь, что старый формат `postgresql://` не остался в конфигурации.

> TTL-параметры читаются через `Duration.parse`, поэтому используйте ISO-8601 строки (`PT15M`, `PT1H`, `P7D` и т.п.). Пустые значения переменных воспринимаются как сигнал применить стандартные `PT15M` и `P7D`. Для обратной совместимости по-прежнему принимается исторический формат `PT7D`, но новые конфигурации следует оформлять как `P7D`.
> TTL-параметры читаются через `Duration.parse`, поэтому используйте ISO-8601 строки (`PT15M`, `PT1H`, `P7D` и т.п.). Пустые значения переменных воспринимаются как сигнал применить стандартные `PT15M` и `P7D`.

## Локальный запуск
Перед запуском синхронизируйте переменные окружения: `../../scripts/sync-env.sh backend/auth` создаст или обновит `.env` в каталоге сервиса. Если файл уже существует, скрипт предупредит о перезаписи — при необходимости выберите `skip`. После копирования обновите секреты (`AUTH_JWT_SECRET`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`) и параметры БД/Redis.

```bash
cd backend/auth
./gradlew bootRun
```
Перед стартом убедитесь, что PostgreSQL и Redis доступны и применены миграции (см. ниже). Application context автоматически прогоняет Liquibase и формирует базовые роли `ROLE_USER`/`ROLE_ADMIN`.

> ℹ️ После изменений в [`env.example`](../../env.example) повторно выполните `./scripts/sync-env.sh` из корня репозитория и перезапустите `./gradlew bootRun`, чтобы подтянуть актуальные значения `AUTH_JWT_SECRET`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, `AUTH_ACCESS_TOKEN_TTL` и `AUTH_REFRESH_TOKEN_TTL`. Локальные секреты обязательно перепроверьте после синхронизации.

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

> ℹ️ Главный changelog [`db.changelog-master.yaml`](migrations/db/changelog/db.changelog-master.yaml) использует `relativeToChangelogFile: true`, поэтому include должен выглядеть как `file: changesets/0001-init-auth-tables.yaml` без префикса `db/changelog`. После изменения структуры changelog'ов запустите `./gradlew update`, чтобы проверить, что Liquibase видит новый changeSet.

### Быстрый запуск миграций CRM и Auth

Чтобы применить миграции CRM (Alembic) и Auth (Liquibase) одной командой, переходите в корень репозитория и выполните:

```bash
./scripts/migrate-local.sh
```

Скрипт экспортирует переменные из `.env`, прогоняет `poetry run alembic upgrade head` в `backend/crm`, затем `./gradlew update` здесь. Перед запуском убедитесь, что установлены Poetry, JDK 17, PostgreSQL и Redis доступны, а `.env` создан из `env.example`.

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
docker run --rm -p ${AUTH_SERVICE_PORT:-8081}:8081 \
  -e AUTH_DATABASE_URL="r2dbc:postgresql://auth:auth@postgres:5432/crm?schema=auth" \
  crm-auth:local
```
Если контейнер Auth должен подключаться к PostgreSQL, запущенному на хостовой машине, замените `postgres` на `host.docker.internal` (Linux поддерживается через `extra_hosts` в `infra/docker-compose.yml`). Настоятельно рекомендуется создавать собственный `.env` и передавать только нужные значения через `-e` или `--env-file` при запуске контейнера.

## Дополнительные ссылки
- [Архитектурный обзор](../../docs/architecture.md)
- [Технологический стек Auth](../../docs/tech-stack.md#auth)
- [Общая настройка окружения](../../docs/local-setup.md)
