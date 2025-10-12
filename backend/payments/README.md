# Payments Service

## Назначение
Payments учитывает финансовые операции (платежи, комиссии, возвраты), публикует события в RabbitMQ и опирается на внутренние справочники тарифов. Все расчёты выполняются в валюте RUB без дополнительных пересчётов или внешних конвертаций.【F:docs/architecture.md†L12-L17】【F:docs/tech-stack.md†L202-L236】

## Требования к окружению
- JDK 17 и Gradle 8+ (Spring Boot WebFlux + Spring Cloud Stream).【F:docs/tech-stack.md†L204-L230】
- PostgreSQL (схема `payments`) и RabbitMQ (exchange `payments.events`).【F:docs/architecture.md†L12-L13】【F:docs/tech-stack.md†L214-L236】
- Переменные окружения `PAYMENTS_SERVICE_PORT`, `PAYMENTS_DATABASE_URL`, `PAYMENTS_RABBITMQ_URL` и связанные настройки (см. [`env.example`](../../env.example)).

## Локальный запуск
1. Перейдите в каталог: `cd backend/payments`.
2. Запустите сервис:
   ```bash
   ./gradlew bootRun --args="--spring.profiles.active=local"
   ```
3. Для тестов используйте `./gradlew test` (JUnit + Testcontainers).

## Миграции и скрипты
- Миграции Flyway храните в каталоге [`migrations`](migrations/) и запускайте автоматически при старте приложения или отдельной задачей `./gradlew flywayMigrate`.【F:docs/tech-stack.md†L226-L230】
- Скрипты настройки очередей (`payments.events`, маршрутизация) оформляются через Spring AMQP конфигурацию.
- ⚠️ Миграции ещё не созданы и будут добавлены вместе с исходным кодом сервиса.

## Запуск в Docker
1. Соберите образ через Spring Boot buildpacks:
   ```bash
   ./gradlew bootBuildImage --imageName=crm-payments:local
   ```
2. Запустите контейнер:
   ```bash
   docker run --rm -p ${PAYMENTS_SERVICE_PORT:-8083}:8083 --env-file ../../env.example crm-payments:local
   ```

## Полезные ссылки
- Архитектурные взаимодействия Payments: [`docs/architecture.md`](../../docs/architecture.md#2-взаимодействия-и-потоки-данных).【F:docs/architecture.md†L61-L66】
- Технологический стек и интеграции: [`docs/tech-stack.md`](../../docs/tech-stack.md#payments).【F:docs/tech-stack.md†L202-L230】
