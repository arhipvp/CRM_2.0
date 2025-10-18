# Payments Service

Spring Boot 3 (Reactive) сервис, который управляет графиком платежей и связанными движениями средств. Сервис синхронизируется с CRM/Deals через REST и события RabbitMQ, хранит данные в схеме `payments` общего кластера PostgreSQL и публикует события `payments.events`.

## Быстрый старт

1. Скопируйте `env.example` в корень и в `backend/payments`:
   ```bash
   ./scripts/sync-env.sh backend/payments
   ```
2. Убедитесь, что PostgreSQL и RabbitMQ подняты (`docker compose --env-file .env up -d postgres rabbitmq`).
3. Запустите сервис в локальном профиле:
   ```bash
   cd backend/payments
   SPRING_PROFILES_ACTIVE=local ./gradlew bootRun
   ```

   Переменные `PAYMENTS_R2DBC_URL`, `PAYMENTS_DATABASE_URL`, `PAYMENTS_DB_USER`, `PAYMENTS_DB_PASSWORD` и `PAYMENTS_RABBITMQ_URL` берутся из `.env`. Значения по умолчанию нацелены на локальные экземпляры PostgreSQL (`localhost:5432`, схема `payments`) и RabbitMQ (`amqp://crm:crm@localhost:5672/crm`).

## Docker Compose

`infra/docker-compose.yml` содержит сервис `payments` (профиль `backend`). Он строится из `backend/payments`, пробрасывает порт `8083` и использует переменные `PAYMENTS_*` с `_INTERNAL`-суффиксом для подключения к контейнерам PostgreSQL и RabbitMQ. Для запуска выполните:

```bash
docker compose --env-file .env --profile backend up -d payments
```

Перед первым стартом убедитесь, что переменные `PAYMENTS_DB_USER`/`PAYMENTS_DB_PASSWORD` скопированы в `.env` и не конфликтуют с существующими пользователями. Скрипт `infra/postgres/init.sh` создаёт роль и схему `payments` автоматически.

## Основные переменные окружения

| Переменная | Назначение |
| --- | --- |
| `PAYMENTS_R2DBC_URL` | R2DBC-строка подключения, используется приложением при старте. |
| `PAYMENTS_DATABASE_URL` | JDBC-строка для Flyway. |
| `PAYMENTS_DB_USER` / `PAYMENTS_DB_PASSWORD` | Роль PostgreSQL, которой принадлежат объекты схемы `payments`. |
| `PAYMENTS_RABBITMQ_URL` | Подключение к брокеру для Spring Cloud Stream. |
| `PAYMENTS_SERVICE_PORT` | HTTP-порт сервиса (по умолчанию `8083`). |

Дополнительные опции (`PAYMENTS_EXPORTS_*`, `PAYMENTS_CRM_WEBHOOK_SECRET` и др.) остаются необязательными и могут быть заполнены при подключении внешних интеграций.
