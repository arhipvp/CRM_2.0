# Payments Service

Spring Boot 3 (Reactive) сервис, который управляет графиком платежей и связанными движениями средств. Сервис синхронизируется с CRM/Deals через REST и события RabbitMQ, хранит данные в схеме `payments` общего кластера PostgreSQL и публикует события `payments.events`.

## Статус
- исходный Spring Boot-проект не поддерживается и не обновляется;
- шаблон окружения снова содержит только `PAYMENTS_RABBITMQ_URL` и `PAYMENTS_RABBITMQ_INTERNAL_URL`, чтобы легаси-приложение могло подписываться на очереди; остальные `PAYMENTS_*` по-прежнему считаются устаревшими и не синхронизируются автоматически;
- миграции Flyway и конфигурация очередей описывают прежнюю схему `payments` и нужны только для анализа наследия.

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

## Что можно найти в архиве
- историческую документацию по API (`docs/api/payments.md`),
- старые конфигурации Spring Cloud Stream (`src/main/resources/application*.yml`),
- пример миграций Flyway для схемы `payments` (`migrations/`).
- примеры подключения к RabbitMQ с использованием переменных `PAYMENTS_RABBITMQ_URL` (localhost) и `PAYMENTS_RABBITMQ_INTERNAL_URL` (docker-сеть), синхронизированные с `env.example` и `infra/docker-compose.yml`.

Эти материалы помогают при анализе миграции данных или восстановлении контекста предыдущих интеграций.

## Docker Compose и переменные окружения

В `infra/docker-compose.yml` добавлен сервис `payments` под профилем `legacy`. Он использует общий образ Spring Boot (`infra/docker/spring-boot-service.Dockerfile`) и автоматически получает `PAYMENTS_RABBITMQ_URL` из `.env`. Остальные параметры (`PAYMENTS_DATABASE_URL`, `PAYMENTS_DB_USER` и т.д.) остаются опциональными и должны задаваться вручную при необходимости — шаблон окружения их не восстанавливает.
