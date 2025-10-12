# Audit Service

## Назначение
Audit — централизованный журнал действий пользователей и системных событий. Сервис собирает сообщения из RabbitMQ, пишет их в собственную схему PostgreSQL и предоставляет внутренние REST endpoint'ы для аналитики и отчётности.【F:docs/architecture.md†L17-L18】【F:docs/tech-stack.md†L339-L360】

## Требования к окружению
- JDK 17 и Gradle 8+ (Spring Boot WebFlux + Spring Cloud Stream).【F:docs/tech-stack.md†L339-L347】
- PostgreSQL (схема `audit`), RabbitMQ (`audit.events`, `audit.core`, `audit.dlq`) и persistent volume для локального write-ahead журнала.【F:docs/tech-stack.md†L349-L359】
- Переменные `AUDIT_SERVICE_PORT`, `AUDIT_DATABASE_URL`, `AUDIT_RABBITMQ_URL`, `AUDIT_DLQ_NAME` и т.п. (см. [`env.example`](../../env.example)).

## Локальный запуск
1. Перейдите в каталог: `cd backend/audit`.
2. Запустите сервис:
   ```bash
   ./gradlew bootRun --args="--spring.profiles.active=local"
   ```
3. Для интеграционных тестов используйте `./gradlew test` (Testcontainers).

## Миграции и вспомогательные задачи
- Конфигурации Liquibase/SQL храните в [`migrations`](migrations/). Настройте задачу `./gradlew update` для применения партиционированных таблиц и представлений.【F:docs/tech-stack.md†L349-L354】
- Для агрегации метрик используйте Spring Batch job (см. раздел о материализованных представлениях).【F:docs/tech-stack.md†L351-L353】
- ⚠️ Миграции ещё не созданы и будут добавлены вместе с исходным кодом сервиса.

## Запуск в Docker
1. Соберите образ:
   ```bash
   ./gradlew bootBuildImage --imageName=crm-audit:local
   ```
2. Запустите контейнер:
   ```bash
   docker run --rm -p ${AUDIT_SERVICE_PORT:-8088}:8088 --env-file ../../env.example crm-audit:local
   ```

## Полезные ссылки
- Архитектурная роль Audit: [`docs/architecture.md`](../../docs/architecture.md#1-общая-структура-сервисов).【F:docs/architecture.md†L17-L18】
- Детальный стек и очереди: [`docs/tech-stack.md`](../../docs/tech-stack.md#audit).【F:docs/tech-stack.md†L339-L360】
