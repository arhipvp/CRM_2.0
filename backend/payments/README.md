# Payments Service

## Назначение
Payments учитывает финансовые операции (платежи, комиссии, возвраты), публикует события в RabbitMQ и опирается на внутренние справочники тарифов. Все расчёты выполняются в валюте RUB без дополнительных пересчётов или внешних конвертаций.【F:docs/architecture.md†L12-L17】【F:docs/tech-stack.md†L202-L236】

## Требования к окружению
- JDK 17 и Gradle 8+ (Spring Boot WebFlux + Spring Cloud Stream).【F:docs/tech-stack.md†L204-L230】
- PostgreSQL (схема `payments`) и RabbitMQ (exchange `payments.events`).【F:docs/architecture.md†L12-L13】【F:docs/tech-stack.md†L214-L236】
- Переменные окружения `PAYMENTS_SERVICE_PORT`, `PAYMENTS_DATABASE_URL`, `PAYMENTS_RABBITMQ_URL` и связанные настройки (см. [`env.example`](../../env.example)).

## Локальный запуск

1. Убедитесь, что заданы переменные окружения из корневого [`env.example`](../../env.example) либо экспортируйте их вручную:
   ```bash
   export $(grep -v '^#' ../../env.example | xargs)
   ```
2. Запустите сервис со Spring-профилем `local` (по умолчанию — порт `8083`):
   ```bash
   gradle bootRun -PspringProfile=local
   ```
3. Для профиля `dev` передайте соответствующий параметр:
   ```bash
   gradle bootRun -PspringProfile=dev
   ```

Gradle-задача `test` запускает интеграционные тесты на базе Testcontainers (PostgreSQL + RabbitMQ):
```bash
gradle test
```

## Миграции и скрипты
- Миграции Flyway хранятся в каталоге [`migrations`](migrations/) и запускаются автоматически при старте приложения либо вручную через `gradle flywayMigrate`.【F:docs/tech-stack.md†L226-L230】
- Обмен `payments.events` и связанные сущности описаны в конфигурации Spring AMQP (`com.crm.payments.config`).
- Пилотный набор миграций создаёт схему `payments` и базовые справочники (при необходимости расширяйте список).

## Запуск в Docker
1. Соберите образ через Spring Boot buildpacks:
   ```bash
   gradle bootBuildImage --imageName=crm-payments:local
   ```
2. Запустите контейнер:
   ```bash
   docker run --rm -p ${PAYMENTS_SERVICE_PORT:-8083}:8083 --env-file ../../env.example crm-payments:local
   ```

## Полезные ссылки
- Архитектурные взаимодействия Payments: [`docs/architecture.md`](../../docs/architecture.md#2-взаимодействия-и-потоки-данных).【F:docs/architecture.md†L61-L66】
- Технологический стек и интеграции: [`docs/tech-stack.md`](../../docs/tech-stack.md#payments).【F:docs/tech-stack.md†L202-L230】
