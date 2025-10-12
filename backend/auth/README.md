# Auth Service

## Назначение
Auth — сервис управления пользователями и ролями. Он отвечает за OAuth/OIDC-потоки, выдачу токенов и проверку доступа других компонентов системы, опираясь на собственную схему PostgreSQL и Redis для одноразовых кодов и сессий.【F:docs/architecture.md†L9-L17】【F:docs/tech-stack.md†L144-L160】

## Требования к окружению
- JDK 17 и Gradle 8+ (Spring Boot WebFlux).【F:docs/tech-stack.md†L146-L170】
- Доступ к PostgreSQL-кластеру (схема `auth`) и Redis для хранения токенов/кодев.【F:docs/architecture.md†L9-L17】【F:docs/tech-stack.md†L150-L160】
- Актуальный файл переменных окружения (`.env.local` или `.env`) на основе [`env.example`](../../env.example).

## Локальный запуск
1. Перейдите в каталог сервиса: `cd backend/auth`.
2. Убедитесь, что переменные `AUTH_SERVICE_PORT`, `AUTH_DATABASE_URL`, `AUTH_REDIS_URL` и `AUTH_JWT_ISSUER` заданы (см. комментарии в `env.example`).
3. Выполните запуск через Gradle:
   ```bash
   ./gradlew bootRun --args="--spring.profiles.active=local"
   ```
   Приложение стартует на порту, указанном в `AUTH_SERVICE_PORT` (по умолчанию `8081`).

## Миграции и скрипты
- В каталоге [`migrations`](migrations/) хранится конфигурация Liquibase/SQL-скрипты для схемы `auth`.
- Для запуска миграций используйте задачу `./gradlew update` или приложите миграции к pipeline CI/CD (см. раздел о Liquibase в спецификации сервиса).【F:docs/tech-stack.md†L166-L170】
- ⚠️ Миграции ещё не созданы и будут добавлены вместе с исходным кодом сервиса.

## Запуск в Docker
1. Соберите OCI-образ через buildpacks Spring Boot:
   ```bash
   ./gradlew bootBuildImage --imageName=crm-auth:local
   ```
2. Запустите контейнер, передав переменные окружения:
   ```bash
   docker run --rm -p ${AUTH_SERVICE_PORT:-8081}:8081 --env-file ../../env.example crm-auth:local
   ```
   При необходимости замените `--env-file` на путь к локальной конфигурации.

## Полезные ссылки
- Архитектурный обзор и границы домена: [`docs/architecture.md`](../../docs/architecture.md).【F:docs/architecture.md†L9-L18】
- Подробный стек и интеграции Auth: [`docs/tech-stack.md`](../../docs/tech-stack.md#auth).【F:docs/tech-stack.md†L144-L170】
- Настройки переменных окружения описаны в [`env.example`](../../env.example) с отсылкой на этот README.
