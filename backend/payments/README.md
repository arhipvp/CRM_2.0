# Payments Service (архив)

Каталог хранит легаси-версию standalone-сервиса платежей. Боевой контур CRM использует встроенный модуль внутри [`backend/crm`](../crm/README.md): именно он публикует REST API и события `deal.payment.*`. Материалы из `backend/payments` нужны только для анализа миграций, сравнения контрактов и экспериментов в изолированной среде.

## Статус
- исходный Spring Boot-проект не поддерживается и не обновляется;
- шаблон окружения снова содержит только `PAYMENTS_RABBITMQ_URL` и `PAYMENTS_RABBITMQ_INTERNAL_URL`, чтобы легаси-приложение могло подписываться на очереди; остальные `PAYMENTS_*` по-прежнему считаются устаревшими и не синхронизируются автоматически;
- миграции Flyway и конфигурация очередей описывают прежнюю схему `payments` и нужны только для анализа наследия.

## Как воспроизвести легаси-сервис локально

> ⚠️ Развёртывание актуального окружения не подразумевает запуск этого сервиса. Запускайте легаси только для экспериментального анализа или повторного воспроизведения старых интеграций.

1. Скопируйте `env.example` в корень и в `backend/payments`:
   ```bash
   ./scripts/sync-env.sh backend/payments
   ```
2. Поднимите отдельные экземпляры PostgreSQL и RabbitMQ (`docker compose --env-file .env up -d postgres rabbitmq`).
3. Запустите сервис в локальном профиле:
   ```bash
   cd backend/payments
   SPRING_PROFILES_ACTIVE=local ./gradlew bootRun
   ```
   > ℹ️ Шаблон `env.example` больше не содержит значение `PAYMENTS_CRM_WEBHOOK_SECRET`. Если нужно принять вебхуки от актуальной CRM, задайте секрет вручную в `.env` этого сервиса или через переменную окружения перед запуском.

## Что можно найти в архиве
- историческую документацию по API (`docs/api/payments.md`),
- старые конфигурации Spring Cloud Stream (`src/main/resources/application*.yml`),
- пример миграций Flyway для схемы `payments` (`migrations/`).
- примеры подключения к RabbitMQ с использованием переменных `PAYMENTS_RABBITMQ_URL` (localhost) и `PAYMENTS_RABBITMQ_INTERNAL_URL` (docker-сеть), синхронизированные с `env.example` и `infra/docker-compose.yml`.

Эти материалы помогают при анализе миграции данных или восстановлении контекста предыдущих интеграций.

## Docker Compose и переменные окружения

В `infra/docker-compose.yml` добавлен сервис `payments` под профилем `legacy`. Он использует общий образ Spring Boot (`infra/docker/spring-boot-service.Dockerfile`) и автоматически получает `PAYMENTS_RABBITMQ_URL` из `.env`. Остальные параметры подключения к базе данных (JDBC/R2DBC URL, логины, пароли) остаются опциональными и должны задаваться вручную при необходимости — шаблон окружения их не восстанавливает.
